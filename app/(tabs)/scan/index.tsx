/**
 * Ürün Sorgula — Birleşik Ekran
 * Arama, barkod tarama ve fotoğrafla bulma aynı sayfada.
 */
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "@/local_demo_data/safe_runtime_shims_v74";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductImage } from "@/components/ProductImage";
import { useColors } from "@/hooks/useColors";
import { searchSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { supabase } from "@/local_demo_data/safe_runtime_shims_v74";
import { pickImage, type PickedImage } from "@/local_demo_data/safe_runtime_shims_v74";
import { preprocessImage } from "@/lib/imagePreprocessService";
import { decodeBarcodeFromImage } from "@/lib/barcodeDecodeFromImageService";
import { searchProductByBarcode } from "@/lib/productSearchService";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import type { Product } from "@/types/product";

const MAX_RECENT = 8;

// ─── Yardımcı ─────────────────────────────────────────
function normalizeQuery(q: string) {
  return q.trim().toLowerCase();
}

function addToRecent(list: string[], q: string): string[] {
  const n = normalizeQuery(q);
  if (!n || n.length < 2) return list;
  const filtered = list.filter(x => normalizeQuery(x) !== n);
  return [q.trim(), ...filtered].slice(0, MAX_RECENT);
}

// ─── ECZ4: Compact search-result row ──────────────────
// Local row component for the Tara / Ürün Sorgula text-search results.
// Replaces the previous 2-col ProductCard grid because gridMode boxed the
// thumbnail inside a tall padded card (image looked "içe kapanmış").
// This row gives the photo a clean 56×56 leading-edge presence with
// name + brand alongside, plus an optional segment chip.
//
// Notes:
//   • ProductImage internals are NOT modified — used as a black box at a
//     smaller size in a different container.
//   • No reusable row component existed (RecommendationRow is a
//     horizontal carousel tied to ProfileRecommendation; Home itself uses
//     the same ProductCard grid). Hence this small local component.
//   • Kept intentionally local + simple — no Home logic imported.
const SEGMENT_LABELS: Record<string, string> = {
  ekonomik:    "Ekonomik",
  profesyonel: "Pro",
  "seçkin":    "Seçkin",
};

interface ScanProductRowProps {
  product: Product;
  onPress: () => void;
}

const ScanProductRow = React.memo(function ScanProductRow({
  product,
  onPress,
}: ScanProductRowProps) {
  const colors = useColors();
  const name      = product.name  ?? product.isim  ?? "—";
  const brand     = product.brand ?? product.marka ?? "";
  const segmentRaw = String(product.segment ?? "");
  const segmentLabel = segmentRaw ? (SEGMENT_LABELS[segmentRaw] ?? segmentRaw) : "";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      style={({ pressed }) => [
        styles.scanRow,
        {
          backgroundColor: colors.surface,
          borderColor:     colors.border,
          opacity:         pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.scanRowImageBox}>
        <ProductImage
          imageUrl={product.image_url}
          thumbnailUrl={product.thumbnail_url}
          gorselUrl={product.gorsel_url}
          mode="thumbnail"
          size={56}
          borderRadius={10}
        />
      </View>
      <View style={styles.scanRowText}>
        <Text style={[styles.scanRowName, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
        {!!brand && (
          <Text style={[styles.scanRowBrand, { color: colors.textMuted }]} numberOfLines={1}>
            {brand}
          </Text>
        )}
        {!!segmentLabel && (
          <View style={[styles.scanRowSegment, { borderColor: colors.border }]}>
            <Text style={[styles.scanRowSegmentText, { color: colors.textSecondary }]}>
              {segmentLabel}
            </Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
});

const ScanRowSeparator = () => <View style={styles.scanRowSeparator} />;

// ─── Barkod bulunamadı sheet ───────────────────────────
interface NotFoundSheet {
  visible: boolean;
  barkod: string;
}

// ─── Manuel barkod modalı ─────────────────────────────
interface ManualSheet {
  visible: boolean;
  value: string;
}

// ─── Ürün öner modalı ─────────────────────────────────
interface SuggestionModal {
  visible: boolean;
  barcode: string;
  productName: string;
  brand: string;
  category: string;
  ingredients: string;
  frontImage: PickedImage | null;
  ingredientsImages: PickedImage[];
  submitting: boolean;
}

const MAX_INGREDIENTS_PHOTOS = 3;

const SUGGESTION_INITIAL: SuggestionModal = {
  visible: false,
  barcode: "",
  productName: "",
  brand: "",
  category: "",
  ingredients: "",
  frontImage: null,
  ingredientsImages: [],
  submitting: false,
};

// Convert base64 string → Uint8Array for Supabase Storage uploads.
// Uses globalThis.atob (Hermes provides it). Keeps zero new dependencies.
function base64ToUint8Array(base64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (!atobFn) throw new Error("atob is not available in this runtime");
  const binary = atobFn(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Best-effort upload of a base64 image into the product-suggestions bucket.
// Returns public URL on success, null otherwise. NEVER throws to caller.
// `filename` is the basename without extension (e.g. "front", "ingredients_1").
async function uploadSuggestionImage(
  barcode: string,
  filename: string,
  base64: string,
): Promise<string | null> {
  try {
    const safeBarcode = barcode.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `suggestions/${safeBarcode}/${safeName}.jpg`;
    const bytes = base64ToUint8Array(base64);
    const { error } = await supabase.storage
      .from("product-suggestions")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.warn(`[product-suggestions] upload (${filename}) failed:`, {
        message: error.message,
        statusCode: (error as any).statusCode,
        error: (error as any).error,
        name: error.name,
      });
      return null;
    }
    const { data } = supabase.storage.from("product-suggestions").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn(`[product-suggestions] upload (${filename}) threw:`, err);
    return null;
  }
}

// Suggestion modal: image picker card. Shows a thumbnail + remove "x"
// once an image is selected, otherwise a tappable empty slot styled like
// a button. `required` toggles accent border + subtitle wording.
function SuggestionImageCard({
  actionTextEmpty,
  actionTextFilled,
  image,
  colors,
  disabled,
  required,
  onPick,
  onRemove,
}: {
  actionTextEmpty: string;
  actionTextFilled: string;
  image: PickedImage | null;
  colors: ReturnType<typeof useColors>;
  disabled: boolean;
  required?: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  if (image) {
    return (
      <View style={[styles.suggestImageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image source={{ uri: image.uri }} style={styles.suggestImageThumb} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
            {actionTextFilled}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            Değiştirmek için “×” ile kaldır
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove} disabled={disabled} hitSlop={8}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }
  const accent = required ? colors.primary : colors.border;
  const subtitle = required ? "Zorunlu" : "İsteğe bağlı";
  const subtitleColor = required ? colors.primary : colors.textMuted;
  return (
    <TouchableOpacity
      style={[styles.suggestImageCard, { backgroundColor: colors.surface, borderColor: accent, borderStyle: "dashed" }]}
      onPress={onPick}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.suggestImageIcon, { backgroundColor: "#eef2ff" }]}>
        <Feather name="camera" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{actionTextEmpty}</Text>
        <Text style={{ color: subtitleColor, fontSize: 11, marginTop: 2, fontWeight: required ? "600" : "400" }}>
          {subtitle}
        </Text>
      </View>
      <Feather name="plus-circle" size={20} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  // Kamera
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Kamera izni yalnızca "Barkod Tara" butonuna basıldığında istenir —
  // ekrana girildiğinde otomatik diyalog çıkmamalı.

  // ECZ4 — Scan results now use a compact vertical row layout
  // (ScanProductRow) instead of the 2-col ProductCard grid. The previous
  // catalog/learningProfile wiring (used to feed ProductCard.smartBadges)
  // is therefore no longer needed and was removed to avoid an unused
  // catalog fetch.

  // Arama
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  // Hard scan lock: set at the entry of every scan/navigation function.
  // Stays locked across navigation; resets ONLY on screen refocus
  // (useFocusEffect) or on a failed scan (each early-return path releases it).
  // Guarantees that ONE scan trigger produces AT MOST one product navigation.
  const scanLockRef = useRef(false);

  // Modallar
  const [notFoundSheet, setNotFoundSheet] = useState<NotFoundSheet>({ visible: false, barkod: "" });
  const [manualSheet, setManualSheet] = useState<ManualSheet>({ visible: false, value: "" });
  const [suggestionModal, setSuggestionModal] = useState<SuggestionModal>(SUGGESTION_INITIAL);

  // Single source of truth for closing the suggestion sheet — used by:
  //   • Vazgeç button
  //   • backdrop tap
  //   • Modal onRequestClose (Android back)
  //   • swipe-down gesture on the top handle
  // While submitting we silently no-op to prevent partial closes.
  const closeSuggestionModal = useCallback(() => {
    if (suggestionModal.submitting) return;
    setSuggestionModal(SUGGESTION_INITIAL);
  }, [suggestionModal.submitting]);

  // Modal kapatma: handle (üst çizgi) tıklanarak kapanır. Swipe gesture
  // kaldırıldı (PanResponder denemeleri ScrollView ile çakışıyordu).
  // Backdrop tap, Vazgeç butonu, Android back hâlâ aktif.

  // Foto loading + durum metni
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string>("");

  // Arama çubuğu odaklanma animasyonu
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    Animated.timing(borderAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    Animated.timing(borderAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const hasResults = results.length > 0;
  const showRecent = !query && recentSearches.length > 0;
  const showEmpty = !!query && !loading && results.length === 0;

  // ── Arama ────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { results } = await searchSupabaseProducts(q.trim());
      setResults(results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(() => doSearch(text), 420);
  };

  const handleSearchSubmit = () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setRecentSearches(prev => addToRecent(prev, query));
    doSearch(query);
  };

  const pickRecent = (q: string) => {
    setQuery(q);
    doSearch(q);
    inputRef.current?.focus();
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  // Hard lock reset: only when the scan tab regains focus (e.g. user comes
  // back from the product detail). This guarantees a fresh scan can fire.
  useFocusEffect(
    useCallback(() => {
      scanLockRef.current = false;
    }, [])
  );

  // Cross-screen entry: home's "Ürün öner" CTA navigates here with
  // ?openSuggest=1 to open the SuggestionModal directly. The param is cleared
  // after handling so a manual return to the tab does NOT re-open the sheet.
  // Local state lives in this screen — this is the bridge from /(home).
  const { openSuggest } = useLocalSearchParams<{ openSuggest?: string }>();
  useEffect(() => {
    if (openSuggest === "1") {
      setSuggestionModal({ ...SUGGESTION_INITIAL, visible: true, barcode: "" });
      router.setParams({ openSuggest: "" });
    }
  }, [openSuggest]);

  const navigateToProduct = useCallback((product: Product) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    Keyboard.dismiss();
    if (query.trim()) setRecentSearches(prev => addToRecent(prev, query));
    prefetchProductHeroImage(product as any);
    setNavigationProduct(product);
    router.replace(`/product/${product.id}`);
  }, [query]);

  // ── Barkod ────────────────────────────────────────────
  const openCamera = async () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      Alert.alert("Bilgi", "Barkod tarama sadece mobil cihazda çalışır. Manuel barkod girişini deneyin.");
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("İzin Gerekli", "Barkod taramak için kamera erişimine izin verin.");
        return;
      }
    }
    setScanned(false);
    setCameraOpen(true);
  };

  // Re-scan barcode from a photo (camera/gallery) WITHOUT leaving the
  // suggestion modal. Reuses the same decode pipeline as runPhotoBarcodeScan
  // but never touches scanLockRef and never triggers product lookup.
  const runSuggestionBarcodeRescan = useCallback(async (source: "camera" | "gallery") => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      const processed = await preprocessImage(picked);
      const decode = await decodeBarcodeFromImage(
        processed.uri,
        processed.width,
        processed.height,
        processed.base64,
      );
      if (!decode.success) {
        Alert.alert(
          "Barkod okunamadı",
          "Bu görselde okunabilir barkod tespit edilemedi. Lütfen daha net bir fotoğraf dene.",
        );
        return;
      }
      setSuggestionModal(s => ({ ...s, barcode: decode.data.barcode }));
    } catch (err) {
      console.warn("[suggestion barcode rescan] failed:", err);
      Alert.alert("Barkod taranamadı", "Lütfen tekrar dene.");
    }
  }, []);

  const rescanSuggestionBarcode = useCallback(() => {
    Alert.alert(
      "Barkod tara",
      "Bir kaynak seç",
      [
        {
          text: "📷  Kamerayla Çek",
          onPress: async () => { await runSuggestionBarcodeRescan("camera"); },
        },
        {
          text: "🖼️  Galeriden Seç",
          onPress: async () => { await runSuggestionBarcodeRescan("gallery"); },
        },
        { text: "İptal", style: "cancel" },
      ]
    );
  }, [runSuggestionBarcodeRescan]);

  // Open camera/gallery picker for a suggestion image.
  // Failure-safe: any error or cancel leaves the slot untouched.
  const pickSuggestionImage = useCallback((kind: "front" | "ingredients") => {
    // For ingredients we APPEND (cap at MAX_INGREDIENTS_PHOTOS); for front we REPLACE.
    // Cap-check happens both at pick-time (defense) and at button-render-time.
    const applyPicked = (picked: PickedImage) => {
      setSuggestionModal(s => {
        if (kind === "front") return { ...s, frontImage: picked };
        if (s.ingredientsImages.length >= MAX_INGREDIENTS_PHOTOS) return s;
        return { ...s, ingredientsImages: [...s.ingredientsImages, picked] };
      });
    };
    Alert.alert(
      kind === "front" ? "Ön yüz fotoğrafı" : "İçerik (arka yüz) fotoğrafı",
      "Bir kaynak seç",
      [
        {
          text: "📷  Kamerayla Çek",
          onPress: async () => {
            try {
              const picked = await pickImage("camera");
              if (!picked) return;
              applyPicked(picked);
            } catch (err) {
              console.warn("[suggestion picker] camera failed:", err);
            }
          },
        },
        {
          text: "🖼️  Galeriden Seç",
          onPress: async () => {
            try {
              const picked = await pickImage("gallery");
              if (!picked) return;
              applyPicked(picked);
            } catch (err) {
              console.warn("[suggestion picker] gallery failed:", err);
            }
          },
        },
        { text: "İptal", style: "cancel" },
      ]
    );
  }, []);

  // Submit a user-suggested product. Two flows share the same pipeline:
  //   • Barcoded:   review_status=pending_review, source_type=barcode_scan
  //   • Barcodeless: review_status=pending_review, source_type=manual_no_barcode
  // Barcode is OPTIONAL. productName + brand + ≥1 ingredient photo are REQUIRED.
  // NEVER writes to the main `products` table — only `product_suggestions`.
  // Admin (admin/product-suggestions.tsx) is the only path into `products`.
  // NOTE on metadata columns: review_status / source_type semantics live in
  // the existing `status` / `source` columns to avoid schema changes; comment
  // labels above describe the intended logical states.
  const submitProductSuggestion = useCallback(async () => {
    // Idempotency guard: ignore double-taps while an insert is in-flight.
    if (suggestionModal.submitting) return;
    // Required text fields (product_name + brand). Barcode optional.
    if (
      !suggestionModal.productName.trim() ||
      !suggestionModal.brand.trim()
    ) return;
    // Ingredients/back photo(s) REQUIRED — admin will extract ingredients from them.
    if (suggestionModal.ingredientsImages.length === 0) {
      Alert.alert(
        "İçerik fotoğrafı gerekli",
        "Ürünü doğru ekleyebilmemiz için arka yüz/ içerik fotoğrafını eklemelisin.",
      );
      return;
    }

    const trimmedBarcode = suggestionModal.barcode.trim();

    // Best-effort duplicate pre-check — ONLY when barcode is present.
    // Barkodsuz akışta brand+name normalize sorgusu, false-positive riski
    // yüksek olduğu için atlanır (talimat 4: güvenli değilse atla).
    if (trimmedBarcode) {
      try {
        const { data: dup, error: dupErr } = await supabase
          .from("product_suggestions")
          .select("id")
          .eq("barcode", trimmedBarcode)
          .eq("status", "pending_admin_review")
          .limit(1)
          .maybeSingle();
        if (!dupErr && dup) {
          const proceed = await new Promise<boolean>(resolve => {
            Alert.alert(
              "Bu barkod zaten incelemede",
              "Bu barkod daha önce inceleme listesine alınmış. Yine de ek bilgi göndermek isterseniz devam edebilirsiniz.",
              [
                { text: "Vazgeç", style: "cancel", onPress: () => resolve(false) },
                { text: "Yine de gönder", onPress: () => resolve(true) },
              ],
              { cancelable: false },
            );
          });
          if (!proceed) return;
        }
      } catch (err) {
        // Non-blocking: any pre-check failure must never stop a submit.
        console.warn("[product_suggestions] dup pre-check skipped:", err);
      }
    } else {
      console.log("[product_suggestions] no-barcode submission, dup check skipped");
    }

    setSuggestionModal(s => ({ ...s, submitting: true }));

    // Storage path key — synthetic per-submission key when no barcode,
    // prevents `unknown/front.jpg` upsert collisions across users.
    const uploadKey = trimmedBarcode
      || `nobarcode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const ingredientsList = suggestionModal.ingredientsImages;
    const frontImage = suggestionModal.frontImage;

    // Upload all ingredients photos in parallel; ALL must succeed.
    // Front photo uploads in parallel but is best-effort (failure = null).
    const [ingredientsUrls, frontUrl] = await Promise.all([
      Promise.all(
        ingredientsList.map((img, i) =>
          uploadSuggestionImage(uploadKey, `ingredients_${i + 1}`, img.base64),
        ),
      ),
      frontImage
        ? uploadSuggestionImage(uploadKey, "front", frontImage.base64)
        : Promise.resolve(null),
    ]);

    if (ingredientsUrls.some(u => !u)) {
      // Hard block: at least one ingredients photo failed to upload.
      setSuggestionModal(s => ({ ...s, submitting: false }));
      Alert.alert("Fotoğraf yüklenemedi. Lütfen tekrar dene.");
      return;
    }
    const validIngredientsUrls = ingredientsUrls as string[];
    console.log("[product_suggestions] validIngredientsUrls:", validIngredientsUrls);

    const payload = {
      // barcode column kept text — null when user didn't supply one.
      barcode: trimmedBarcode || null,
      product_name: suggestionModal.productName.trim(),
      brand: suggestionModal.brand.trim(),
      category: suggestionModal.category.trim() || null,
      ingredients_text: suggestionModal.ingredients.trim() || null,
      front_image_url: frontUrl,
      // First URL kept for backward compatibility with existing admin tooling.
      ingredients_image_url: validIngredientsUrls[0],
      ingredients_image_urls: validIngredientsUrls,
      // `source` carries source_type semantics — barcoded vs barcodeless flow.
      source: trimmedBarcode ? "scan_unknown_barcode" : "manual_no_barcode",
      // `status` carries review_status semantics — admin queue uses pending_admin_review.
      status: "pending_admin_review",
      created_at: new Date().toISOString(),
    };
    try {
      const { error: insertError } = await supabase
        .from("product_suggestions")
        .insert(payload);

      if (insertError) {
        console.warn("[product_suggestions] insert failed:", insertError);
      } else {
        console.log("[product_suggestions] insert success", { source: payload.source });
      }
    } catch (err) {
      console.warn("[product_suggestions] insert threw:", err);
    }
    // Reset and thank user. Insert failure is logged silently per warm-UX rule;
    // ingredients photo upload failure is the only hard block above.
    setSuggestionModal(SUGGESTION_INITIAL);
    Alert.alert(
      "Teşekkürler",
      "Önerini aldık. İnceleme kuyruğuna eklendi.",
      [
        { text: "Tamam" },
        { text: "Fotoğrafla dene", onPress: () => runPhotoBarcodeScan("camera") },
      ]
    );
  }, [
    suggestionModal.submitting,
    suggestionModal.barcode,
    suggestionModal.productName,
    suggestionModal.brand,
    suggestionModal.category,
    suggestionModal.ingredients,
    suggestionModal.frontImage,
    suggestionModal.ingredientsImages,
  ]);

  const handleBarcode = useCallback(async ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    if (scanned) return;
    setScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCameraOpen(false);
    setLoading(true);
    try {
      // Exact barcode SQL match against Supabase catalog. On a hit, navigate
      // to the canonical UUID product detail; on a miss (or lookup error),
      // show the existing "Ürün bulunamadı" sheet so the user can suggest
      // the product. We never present external/partial product data as a
      // real detail page — same rule applies to runPhotoBarcodeScan below.
      const canonical = await searchProductByBarcode(data);
      if (canonical.success) {
        prefetchProductHeroImage(canonical.product as any);
        setNavigationProduct(canonical.product);
        router.replace(`/product/${canonical.product.id}`);
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotFoundSheet({ visible: true, barkod: data });
      scanLockRef.current = false;
    } catch {
      Alert.alert("Bağlanamadık", "Şu an işlemi tamamlayamadık. Bağlantınızı kontrol edip tekrar deneyin.");
      scanLockRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [scanned]);

  const searchByBarcode = () => {
    const bc = notFoundSheet.barkod;
    setNotFoundSheet({ visible: false, barkod: "" });
    setScanned(false);
    setQuery(bc);
    doSearch(bc);
  };

  // ── Manuel Barkod ─────────────────────────────────────
  const submitManualBarcode = async () => {
    const bc = manualSheet.value.trim();
    if (!bc) return;
    setManualSheet({ visible: false, value: "" });
    Keyboard.dismiss();
    await handleBarcode({ data: bc });
  };

  // ── Fotoğraftan barkod tara (native expo-camera motoru) ─
  const runPhotoBarcodeScan = async (source: "camera" | "gallery") => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    // 1. Görsel al
    const picked = await pickImage(source);
    if (!picked) {
      scanLockRef.current = false;
      return; // İptal veya izin reddedildi
    }

    setPhotoLoading(true);
    setPhotoStatus("Görsel optimize ediliyor...");

    try {
      // 2. Boyutlandır — uri döner (scanFromURLAsync için)
      const processed = await preprocessImage(picked);

      setPhotoStatus("Barkod aranıyor...");

      // 3. Barkod çöz — Katman 1: Native (9 geçiş), Katman 2: Python API
      //    iOS: Apple Vision, Android: ML Kit + zxing-cpp fallback
      const decode = await decodeBarcodeFromImage(
        processed.uri,
        processed.width,
        processed.height,
        processed.base64
      );

      if (!decode.success) {
        setPhotoLoading(false);
        setPhotoStatus("");
        scanLockRef.current = false;

        if (decode.error === "not_found") {
          Alert.alert(
            "Barkod Bulunamadı",
            "Bu görselde okunabilir barkod tespit edilemedi.\n\n" +
            "İpuçları:\n• Barkodun tüm çubukları görünsün\n• Barkodu düz ve yakından çek\n• Işık yeterli olsun",
            [
              { text: "Tekrar Dene",      onPress: () => handlePhoto() },
              { text: "Elle Gir",         onPress: () => setManualSheet({ visible: true, value: "" }) },
              { text: "Canlı Tara",       onPress: () => openCamera(), style: "cancel" },
            ]
          );
        } else {
          Alert.alert(
            "Barkod Okunamadı",
            decode.message + "\n\nElle barkod girmeyi deneyin.",
            [
              { text: "Elle Gir",   onPress: () => setManualSheet({ visible: true, value: "" }) },
              { text: "Tamam",      style: "cancel" },
            ]
          );
        }
        return;
      }

      const { barcode, format, allFound } = decode.data;
      console.log(`[PhotoScan] Barkod bulundu: ${barcode} (${format}), toplam: ${allFound.length}`);

      setPhotoStatus("Ürün veritabanında aranıyor...");

      // 4. Supabase'de ürün ara
      const search = await searchProductByBarcode(barcode);

      setPhotoLoading(false);
      setPhotoStatus("");

      if (!search.success) {
        if (search.reason === "not_found") {
          // Barkod okundu ama ürün DB'de yok
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setNotFoundSheet({ visible: true, barkod: barcode });
        } else {
          Alert.alert("Sorgu Hatası", search.message);
        }
        scanLockRef.current = false;
        return;
      }

      // 5. Ürün bulundu → detay ekranına git
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      prefetchProductHeroImage(search.product as any);
      setNavigationProduct(search.product);
      router.replace(`/product/${search.product.id}`);
    } catch (err: any) {
      setPhotoLoading(false);
      setPhotoStatus("");
      Alert.alert("Görsel Okunamadı", "Görsel işlenirken bir sorun oluştu. Lütfen daha net bir fotoğraf deneyin.");
      scanLockRef.current = false;
    }
  };

  const handlePhoto = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Barkod Tara",
      "Barkod içeren fotoğrafı nereden almak istersiniz?",
      [
        { text: "📷  Kamerayla Çek",  onPress: () => runPhotoBarcodeScan("camera")  },
        { text: "🖼️  Galeriden Seç",  onPress: () => runPhotoBarcodeScan("gallery") },
        { text: "İptal", style: "cancel" },
      ]
    );
  };

  // ── Render: boş durum (no query) ─────────────────────
  const renderEmpty = () => (
    <ScrollView
      contentContainerStyle={[styles.emptyScroll, { paddingBottom: botPad + 120 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Son Aramalar */}
      {showRecent && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: colors.textSecondary }]}>Son Aramalar</Text>
            <TouchableOpacity onPress={() => setRecentSearches([])}>
              <Text style={[styles.clearText, { color: colors.textMuted }]}>Temizle</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.recentRow, { borderBottomColor: colors.border }]}
              onPress={() => pickRecent(item)}
            >
              <Feather name="clock" size={14} color={colors.textMuted} />
              <Text style={[styles.recentText, { color: colors.text }]} numberOfLines={1}>{item}</Text>
              <Feather name="arrow-up-left" size={13} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

    </ScrollView>
  );

  // ── Render: sonuç listesi ─────────────────────────────
  // ECZ4 — Compact vertical row layout (ScanProductRow). The 2-col
  // ProductCard grid is intentionally NOT used here: gridMode embedded the
  // image inside a tall padded card which made the photo feel
  // "içe kapanmış" / boxed. The row places a 56×56 thumbnail at the
  // leading edge with name + brand alongside, restoring image perception
  // without touching ProductImage internals.
  const renderResults = () => (
    <FlatList
      data={results}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <ScanProductRow
          product={item}
          onPress={() => navigateToProduct(item)}
        />
      )}
      ItemSeparatorComponent={ScanRowSeparator}
      contentContainerStyle={[styles.resultsList, { paddingBottom: botPad + 120 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={() => Keyboard.dismiss()}
      showsVerticalScrollIndicator={false}
    />
  );

  // ── Render ana ────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Başlık + Arama ──────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ürün Sorgula</Text>

        {/* Arama kutusu */}
        <Animated.View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surfaceCard,
              borderColor: borderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, colors.primary],
              }),
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Ürün adı, marka veya barkod..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="search"
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {!loading && query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x-circle" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Hızlı işlem butonları */}
        <View style={styles.actionRow}>
          {/* Barkod tara */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={openCamera}
            activeOpacity={0.85}
          >
            <Feather name="maximize" size={17} color="#fff" />
            <Text style={styles.actionBtnText}>Barkod Tara</Text>
          </TouchableOpacity>

          {/* Fotoğrafla bul */}
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: photoLoading ? colors.primary : colors.border, backgroundColor: colors.surfaceCard }]}
            onPress={handlePhoto}
            disabled={photoLoading}
            activeOpacity={0.8}
          >
            {photoLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="image" size={15} color={colors.text} />
            }
            <Text style={[styles.actionBtnOutlineText, { color: photoLoading ? colors.primary : colors.text }]} numberOfLines={1}>
              {photoLoading ? (photoStatus || "İşleniyor...") : "Fotoğraf"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── İçerik alanı ─────────────────────────────── */}
      {/* ECZ4 — Tap on empty/loading body areas dismisses keyboard.
           Pressable here only wraps NON-list states (loading, empty result,
           recent-search empty). The FlatList result path is rendered
           directly below and handles drag-dismissal via keyboardDismissMode
           and onScrollBeginDrag — so this Pressable does NOT wrap the list
           and cannot swallow ProductCard taps. */}
      <View style={styles.body}>
        {loading && results.length === 0 && query.length > 0 ? (
          <Pressable style={styles.loadingCenter} onPress={() => Keyboard.dismiss()}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Aranıyor...</Text>
          </Pressable>
        ) : showEmpty ? (
          // ECZ4 — Pressable wrapper dismisses keyboard on background tap.
          // Inner TouchableOpacity ("Bu ürünü öner") still receives its own
          // press because RN gesture bubbling lets the child handler win.
          <Pressable style={styles.emptyCenter} onPress={() => Keyboard.dismiss()}>
            <View style={[styles.emptyIconBox, { backgroundColor: `${colors.textMuted}12` }]}>
              <Feather name="search" size={30} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Ürün bulunamadı</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              "{query}" için sonuç yok. Farklı bir terim deneyin.
            </Text>
            <TouchableOpacity
              style={[styles.suggestBtn, { borderColor: colors.primary }]}
              onPress={() => setSuggestionModal({
                ...SUGGESTION_INITIAL,
                visible: true,
                barcode: "",
              })}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.suggestText, { color: colors.primary }]}>Bu ürünü öner</Text>
            </TouchableOpacity>
          </Pressable>
        ) : hasResults ? (
          renderResults()
        ) : (
          renderEmpty()
        )}
      </View>

      {/* ══════════════════════════════════════════════
          KAMERA MODAL (tam ekran)
          ══════════════════════════════════════════════ */}
      <Modal
        visible={cameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setCameraOpen(false); setScanned(false); }}
      >
        <View style={styles.cameraModal}>
          {Platform.OS !== "web" && permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "qr", "upc_a", "upc_e", "code128", "code39"],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcode}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
              <Feather name="camera-off" size={44} color="#fff" />
              <Text style={{ color: "#fff", marginTop: 12, fontSize: 16 }}>Kamera kullanılamıyor</Text>
            </View>
          )}

          {/* Overlay UI */}
          <View style={styles.cameraOverlay}>
            {/* Üst çubuk */}
            <View style={[styles.cameraTopBar, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity
                style={styles.cameraCloseBtn}
                onPress={() => { setCameraOpen(false); setScanned(false); }}
              >
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>Barkod Tara</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Çerçeve */}
            <View style={styles.framingArea}>
              <View style={[styles.dimFlex, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
              <View style={styles.frameRow}>
                <View style={[styles.dimSide, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
                <View style={styles.frameBox}>
                  <View style={[styles.corner, styles.cornerTL, { borderColor: "#B87333" }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: "#B87333" }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: "#B87333" }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: "#B87333" }]} />
                  {/* Tarama çizgisi */}
                  <View style={styles.scanLine} />
                </View>
                <View style={[styles.dimSide, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
              </View>
              <View style={[styles.dimFlex, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                <Text style={styles.frameHint}>Barkodu çerçeve içine hizala</Text>
              </View>
            </View>

            {/* Alt alan */}
            <View style={[styles.cameraBottomBar, { paddingBottom: insets.bottom + 24 }]}>
              {loading ? (
                <View style={styles.scanStatusRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.scanStatusText}>Ürün aranıyor...</Text>
                </View>
              ) : scanned ? (
                <TouchableOpacity
                  style={[styles.rescanBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setScanned(false)}
                >
                  <Feather name="refresh-cw" size={16} color="#fff" />
                  <Text style={styles.rescanText}>Tekrar Tara</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.scanHintText}>
                  EAN-8 · EAN-13 · QR · UPC barkodları desteklenir
                </Text>
              )}
              <TouchableOpacity
                style={styles.manualFromCamera}
                onPress={() => { setCameraOpen(false); setManualSheet({ visible: true, value: "" }); }}
              >
                <Feather name="hash" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.manualFromCameraText}>Numarayı elle gir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════
          BARKOD BULUNAMADI SHEET
          ══════════════════════════════════════════════ */}
      <Modal
        visible={notFoundSheet.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotFoundSheet({ visible: false, barkod: "" })}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => { setNotFoundSheet({ visible: false, barkod: "" }); setScanned(false); }}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surfaceCard }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.sheetIcon, { backgroundColor: "#fff7ed" }]}>
            <Text style={{ fontSize: 32 }}>🔍</Text>
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Barkod Bulunamadı</Text>
          <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: "700" }}>{notFoundSheet.barkod}</Text>
            {"\n"}barkodlu ürün henüz veritabanımızda yok.
          </Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={searchByBarcode}
            >
              <Feather name="search" size={16} color="#fff" />
              <Text style={styles.sheetBtnText}>İsimle Ara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.secondary }]}
              onPress={() => {
                const bc = notFoundSheet.barkod;
                setNotFoundSheet({ visible: false, barkod: "" });
                setScanned(false);
                setSuggestionModal({
                  ...SUGGESTION_INITIAL,
                  visible: true,
                  barcode: bc,
                });
              }}
            >
              <Feather name="plus-circle" size={16} color="#fff" />
              <Text style={styles.sheetBtnText}>Ürün Öner</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.sheetSecondary, { borderColor: colors.border }]}
            onPress={() => { setNotFoundSheet({ visible: false, barkod: "" }); setScanned(false); setCameraOpen(true); }}
          >
            <Feather name="refresh-cw" size={14} color={colors.textMuted} />
            <Text style={[styles.sheetSecondaryText, { color: colors.textMuted }]}>Tekrar Tara</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════
          MANUEL BARKOD SHEET
          ══════════════════════════════════════════════ */}
      <Modal
        visible={manualSheet.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualSheet({ visible: false, value: "" })}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setManualSheet({ visible: false, value: "" })}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.surfaceCard }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Barkod Numarası</Text>
          <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
            Ürünün üzerindeki barkod numarasını girin
          </Text>
          <View style={[styles.manualInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="hash" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.manualTextInput, { color: colors.text }]}
              placeholder="Örn: 8691234567890"
              placeholderTextColor={colors.textMuted}
              value={manualSheet.value}
              onChangeText={(v) => setManualSheet(s => ({ ...s, value: v }))}
              keyboardType="numeric"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={submitManualBarcode}
            />
            {manualSheet.value.length > 0 && (
              <TouchableOpacity onPress={() => setManualSheet(s => ({ ...s, value: "" }))}>
                <Feather name="x" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.sheetBtn,
              {
                backgroundColor: manualSheet.value.trim().length > 2 ? colors.primary : colors.border,
                width: "100%",
                marginTop: 4,
              },
            ]}
            onPress={submitManualBarcode}
            disabled={manualSheet.value.trim().length < 3}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={styles.sheetBtnText}>Ürünü Bul</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════
          ÜRÜN ÖNER SHEET (bilinmeyen barkod için)
          ══════════════════════════════════════════════ */}
      <Modal
        visible={suggestionModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeSuggestionModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              if (suggestionModal.submitting) return;
              Keyboard.dismiss();
              closeSuggestionModal();
            }}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surfaceCard, maxHeight: "92%", paddingBottom: 24 + botPad }]}>
            {/* GÖRÜNÜR X KAPATMA BUTONU — sağ üst köşe.
                Garanti çalışan, görsel feedback'li tek-tap kapatma.
                zIndex:50 + elevation:20 ile her platformda diğer
                katmanların üstünde kalır. submitting iken kapanmama
                kuralı closeSuggestionModal içinde zaten korunuyor. */}
            <TouchableOpacity
              onPress={closeSuggestionModal}
              activeOpacity={0.7}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Pencereyi kapat"
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                zIndex: 50,
                elevation: 20,
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.85)",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, lineHeight: 24 }}>
                ×
              </Text>
            </TouchableOpacity>
            {/* Üst handle = tıklanabilir kapatma (yedek). hitSlop ile geniş
                dokunma alanı. ScrollView'dan bağımsız, çakışma yok. */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={closeSuggestionModal}
              hitSlop={{ top: 16, bottom: 16, left: 80, right: 80 }}
              accessibilityRole="button"
              accessibilityLabel="Pencereyi kapat"
              style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 80 }}
            >
              <View style={[styles.sheetHandle, { backgroundColor: colors.border, width: 44, height: 5, borderRadius: 3 }]} />
            </TouchableOpacity>
            {/* Static header — ikon + title + subtitle (handle yukarıda ayrı). */}
            <View style={{ width: "100%", alignItems: "center" }}>
              <View style={[styles.sheetIcon, { backgroundColor: "#eef2ff" }]}>
                <Feather name="edit-3" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.sheetTitle, { color: colors.text, marginTop: 8 }]}>Ürün öner</Text>
              <Text style={[styles.sheetDesc, { color: colors.textSecondary, paddingHorizontal: 16, textAlign: "center" }]}>
                {suggestionModal.barcode
                  ? "Bu barkodu inceleme listemize ekleyelim."
                  : "Bu ürünü inceleme listemize ekleyelim."}
              </Text>
            </View>
            <ScrollView
              style={{ width: "100%" }}
              contentContainerStyle={{ alignItems: "center", gap: 12, paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

              <View style={{ width: "100%", gap: 10, marginTop: 4 }}>
                {/* Barkod alanı: dolu geldiyse readonly + dim, boşsa elle yazılabilir */}
                {(() => {
                  const isBarcodeReadonly = !!suggestionModal.barcode;
                  return (
                    <>
                      <View style={[styles.manualInput, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isBarcodeReadonly ? 0.75 : 1 }]}>
                        <Feather name="hash" size={16} color={colors.textMuted} />
                        {isBarcodeReadonly ? (
                          <Text style={[styles.manualTextInput, { color: colors.textMuted }]} numberOfLines={1}>
                            {suggestionModal.barcode}
                          </Text>
                        ) : (
                          <TextInput
                            style={[styles.manualTextInput, { color: colors.text }]}
                            placeholder="Barkod (isteğe bağlı)"
                            placeholderTextColor={colors.textMuted}
                            value={suggestionModal.barcode}
                            onChangeText={(v) => setSuggestionModal(s => ({ ...s, barcode: v.replace(/[^0-9]/g, "") }))}
                            editable={!suggestionModal.submitting}
                            keyboardType="numeric"
                            returnKeyType="next"
                          />
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.barcodeRescanBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                        onPress={rescanSuggestionBarcode}
                        disabled={suggestionModal.submitting}
                        activeOpacity={0.7}
                      >
                        <Feather name="maximize" size={16} color={colors.primary} />
                        <Text style={[styles.barcodeRescanText, { color: colors.primary }]}>Barkod tara</Text>
                      </TouchableOpacity>
                      {!isBarcodeReadonly && (
                        <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 15, paddingHorizontal: 4 }}>
                          Barkodu bilmiyorsanız boş bırakabilirsiniz. Öneriniz inceleme kuyruğuna alınır.
                        </Text>
                      )}
                    </>
                  );
                })()}

                {/* Ürün adı (zorunlu) */}
                <View style={[styles.manualInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="tag" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.manualTextInput, { color: colors.text }]}
                    placeholder="Ürün adı *"
                    placeholderTextColor={colors.textMuted}
                    value={suggestionModal.productName}
                    onChangeText={(v) => setSuggestionModal(s => ({ ...s, productName: v }))}
                    returnKeyType="next"
                    autoCapitalize="words"
                    editable={!suggestionModal.submitting}
                  />
                </View>

                {/* Marka (zorunlu) */}
                <View style={[styles.manualInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="award" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.manualTextInput, { color: colors.text }]}
                    placeholder="Marka *"
                    placeholderTextColor={colors.textMuted}
                    value={suggestionModal.brand}
                    onChangeText={(v) => setSuggestionModal(s => ({ ...s, brand: v }))}
                    returnKeyType="next"
                    autoCapitalize="words"
                    editable={!suggestionModal.submitting}
                  />
                </View>

                {/* Kategori (isteğe bağlı) */}
                <View style={[styles.manualInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="grid" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.manualTextInput, { color: colors.text }]}
                    placeholder="Kategori (isteğe bağlı)"
                    placeholderTextColor={colors.textMuted}
                    value={suggestionModal.category}
                    onChangeText={(v) => setSuggestionModal(s => ({ ...s, category: v }))}
                    returnKeyType="next"
                    autoCapitalize="words"
                    editable={!suggestionModal.submitting}
                  />
                </View>

                {/* ── İçerik fotoğrafı (zorunlu, en fazla 3) ── */}
                <View style={{ marginTop: 4 }}>
                  <Text style={[styles.suggestSectionLabel, { color: colors.text }]}>
                    İçerik fotoğrafı <Text style={{ color: colors.primary }}>*</Text>
                    {suggestionModal.ingredientsImages.length > 0 ? (
                      <Text style={{ color: colors.textMuted, fontWeight: "400" }}>
                        {"  "}({suggestionModal.ingredientsImages.length}/{MAX_INGREDIENTS_PHOTOS})
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.suggestHelper, { color: colors.textMuted, marginTop: 2, marginBottom: 8 }]}>
                    İçerik listesini tek kareye sığdıramıyorsan 2–3 parça halinde çek.
                  </Text>

                  {/* Seçilen fotoğrafların thumbnail'leri */}
                  {suggestionModal.ingredientsImages.map((img, idx) => (
                    <View
                      key={`ing-${idx}-${img.uri}`}
                      style={[
                        styles.suggestImageCard,
                        { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 },
                      ]}
                    >
                      <Image source={{ uri: img.uri }} style={styles.suggestImageThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                          İçerik fotoğrafı {idx + 1}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          Kaldırmak için “×”
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSuggestionModal(s => ({
                          ...s,
                          ingredientsImages: s.ingredientsImages.filter((_, i) => i !== idx),
                        }))}
                        disabled={suggestionModal.submitting}
                        hitSlop={8}
                      >
                        <Feather name="x" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Ekle butonu — sadece kapasitede yer varsa */}
                  {suggestionModal.ingredientsImages.length < MAX_INGREDIENTS_PHOTOS ? (
                    <SuggestionImageCard
                      actionTextEmpty={
                        suggestionModal.ingredientsImages.length === 0
                          ? "İçerik fotoğrafı ekle"
                          : "Bir fotoğraf daha ekle"
                      }
                      actionTextFilled=""
                      image={null}
                      colors={colors}
                      disabled={suggestionModal.submitting}
                      required={suggestionModal.ingredientsImages.length === 0}
                      onPick={() => pickSuggestionImage("ingredients")}
                      onRemove={() => { /* unused for empty card */ }}
                    />
                  ) : (
                    <Text style={[styles.suggestHelper, { color: colors.textMuted, textAlign: "center", marginTop: 4 }]}>
                      En fazla {MAX_INGREDIENTS_PHOTOS} fotoğraf eklenebilir.
                    </Text>
                  )}
                </View>

                {/* ── Ön yüz fotoğrafı (isteğe bağlı) ── */}
                <SuggestionImageCard
                  actionTextEmpty="Ön yüz fotoğrafı ekle"
                  actionTextFilled="Ön yüz fotoğrafı eklendi"
                  image={suggestionModal.frontImage}
                  colors={colors}
                  disabled={suggestionModal.submitting}
                  onPick={() => pickSuggestionImage("front")}
                  onRemove={() => setSuggestionModal(s => ({ ...s, frontImage: null }))}
                />

                {/* İçerikler (isteğe bağlı, çok satırlı) */}
                <View style={[styles.suggestTextarea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.suggestTextareaInput, { color: colors.text }]}
                    placeholder="İçerikler (isteğe bağlı)"
                    placeholderTextColor={colors.textMuted}
                    value={suggestionModal.ingredients}
                    onChangeText={(v) => setSuggestionModal(s => ({ ...s, ingredients: v }))}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!suggestionModal.submitting}
                  />
                </View>
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[
                    styles.sheetBtn,
                    { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, flex: 1 },
                    suggestionModal.submitting && { opacity: 0.5 },
                  ]}
                  onPress={closeSuggestionModal}
                  disabled={suggestionModal.submitting}
                >
                  <Text style={[styles.sheetBtnText, { color: colors.text }]}>Vazgeç</Text>
                </TouchableOpacity>
                {(() => {
                  // Barcode is OPTIONAL. Required: productName + brand + ≥1 ingredient photo.
                  const canSubmit =
                    !suggestionModal.submitting &&
                    suggestionModal.productName.trim().length > 0 &&
                    suggestionModal.brand.trim().length > 0 &&
                    suggestionModal.ingredientsImages.length > 0;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.sheetBtn,
                        { backgroundColor: canSubmit ? colors.primary : colors.border, flex: 1 },
                      ]}
                      onPress={submitProductSuggestion}
                      disabled={!canSubmit}
                    >
                      {suggestionModal.submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Feather name="send" size={16} color="#fff" />
                      )}
                      <Text style={styles.sheetBtnText}>Gönder</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 18, paddingBottom: 14, gap: 12 },
  title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.5 },

  // Arama kutusu
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  // Aksiyon butonları
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: "600" as const },

  // Body
  body: { flex: 1 },

  // Loading & empty states
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: "700" as const },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  suggestBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginTop: 6 },
  suggestText: { fontSize: 13, fontWeight: "600" as const },

  // Sonuç listesi
  // ECZ4 — paddingTop:12 keeps the first row off the search controls.
  // Vertical row layout (ScanProductRow) — gridRow / columnWrapperStyle
  // were removed because numColumns is now 1.
  resultsList: { paddingHorizontal: 16, paddingTop: 12 },

  // ── ECZ4: ScanProductRow styles ─────────────────────
  // Compact row: 56×56 thumbnail leading edge, name+brand stacked,
  // optional segment chip, chevron trailing edge.
  scanRow: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              12,
    paddingVertical:  10,
    paddingHorizontal: 12,
    borderRadius:     14,
    borderWidth:      1,
  },
  scanRowImageBox: {
    width:  56,
    height: 56,
    alignItems:     "center",
    justifyContent: "center",
  },
  scanRowText: {
    flex: 1,
    minWidth: 0,
  },
  scanRowName: {
    fontSize:   14,
    fontWeight: "600" as const,
    lineHeight: 18,
    marginBottom: 2,
  },
  scanRowBrand: {
    fontSize:   12,
    fontWeight: "400" as const,
    marginBottom: 4,
  },
  scanRowSegment: {
    alignSelf:        "flex-start",
    borderWidth:      1,
    borderRadius:     6,
    paddingHorizontal: 6,
    paddingVertical:  1,
  },
  scanRowSegmentText: {
    fontSize:   10,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
  scanRowSeparator: {
    height: 8,
  },

  // Empty scroll (recent + tips)
  emptyScroll: { paddingHorizontal: 18, paddingTop: 6 },
  recentSection: { marginBottom: 20 },
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  recentTitle: { fontSize: 13, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  clearText: { fontSize: 13 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  recentText: { flex: 1, fontSize: 14 },

  // İpucu kartları
  tipsSection: { gap: 10 },
  tipsSectionTitle: { fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 },
  tipCards: { gap: 8 },
  tipCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  tipIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tipTitle: { fontSize: 14, fontWeight: "700" as const },
  tipDesc: { fontSize: 12, lineHeight: 16 },

  // Kamera modal
  cameraModal: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitle: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  framingArea: { flex: 1 },
  dimFlex: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 14 },
  frameRow: { height: 130, flexDirection: "row" },
  dimSide: { flex: 1 },
  frameBox: { width: 230, height: 130, position: "relative", overflow: "hidden" },
  corner: { position: "absolute", width: 22, height: 22, borderWidth: 3, borderRadius: 3 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLine: {
    position: "absolute",
    left: 4, right: 4,
    top: "50%",
    height: 1.5,
    backgroundColor: "rgba(184,115,51,0.7)",
  },
  frameHint: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500" as const,
    textAlign: "center" as const,
    marginTop: 10,
  },
  cameraBottomBar: {
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    gap: 14,
    paddingTop: 20,
  },
  scanStatusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanStatusText: { color: "#fff", fontSize: 14 },
  scanHintText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  rescanBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  rescanText: { color: "#fff", fontWeight: "600" as const, fontSize: 14 },
  manualFromCamera: { flexDirection: "row", alignItems: "center", gap: 6 },
  manualFromCameraText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },

  // Shared modals
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 26,
    paddingBottom: 40,
    alignItems: "center",
    gap: 12,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetIcon: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 21, fontWeight: "800" as const },
  sheetDesc: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  sheetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sheetBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  sheetSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 2,
  },
  sheetSecondaryText: { fontSize: 13 },

  // Manuel barkod
  manualInput: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  manualTextInput: { flex: 1, fontSize: 18, padding: 0, letterSpacing: 1 },
  suggestImageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  suggestImageThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    resizeMode: "cover",
    backgroundColor: "#e5e7eb",
  },
  suggestImageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestTextarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 96,
  },
  suggestTextareaInput: {
    fontSize: 15,
    padding: 0,
    minHeight: 76,
  },
  suggestHelper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
    paddingHorizontal: 2,
  },
  suggestSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  barcodeRescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  barcodeRescanText: {
    fontSize: 14,
    fontWeight: "600",
  },
});