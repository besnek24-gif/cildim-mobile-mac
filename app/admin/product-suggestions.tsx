import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/local_demo_data/safe_runtime_shims_v74";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { isAdminUser } from "@/lib/admin/isAdminUser";

// OCR.space free public test key. Replace later with our own key for higher limits.
const OCR_API_KEY = "helloworld";
const OCR_ENDPOINT = "https://api.ocr.space/parse/image";

async function runOcrOnSingleUrl(imageUrl: string): Promise<string | null> {
  try {
    const form = new URLSearchParams();
    form.append("apikey", OCR_API_KEY);
    form.append("url", imageUrl);
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");
    form.append("OCREngine", "2");

    const res = await fetch(OCR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const json: any = await res.json();
    const parsed: string | undefined = json?.ParsedResults?.[0]?.ParsedText;
    if (parsed && parsed.trim().length > 0) {
      return parsed.trim();
    }
    console.warn("[admin/ocr] empty parse for url:", imageUrl, json?.ErrorMessage ?? json);
  } catch (err) {
    console.warn("[admin/ocr] request failed for url:", imageUrl, err);
  }
  return null;
}

function generateShortBenefit(ingredients: string | null): string {
  if (!ingredients) return "Cilt dostu bakım ürünü";

  const text = ingredients.toLowerCase();

  if (text.includes("salicylic")) return "Gözenek arındırıcı, akne karşıtı bakım";
  if (text.includes("niacinamide")) return "Sebum dengeleyici, ton eşitleyici etki";
  if (text.includes("hyaluronic")) return "Yoğun nem desteği sağlayan bakım";
  if (text.includes("glycerin")) return "Nem tutucu, cildi yumuşatan formül";
  if (text.includes("alcohol")) return "Hafif formül, hızlı emilim sağlar";

  return "Cilt bakımını destekleyen dengeli formül";
}

async function runOcrFromUrls(imageUrls: string[]): Promise<{ text: string; source: "ocr" | "mock" }> {
  const valid = imageUrls.filter(u => typeof u === "string" && u.length > 0);
  if (valid.length === 0) {
    return {
      text: "AQUA, GLYCERIN, NIACINAMIDE, CETEARYL ALCOHOL, BUTYROSPERMUM PARKII BUTTER, PANTHENOL, TOCOPHEROL, PHENOXYETHANOL",
      source: "mock",
    };
  }

  // Run all OCR requests in parallel; keep only successful ones.
  const results = await Promise.all(valid.map(runOcrOnSingleUrl));
  const successes = results.filter((t): t is string => typeof t === "string" && t.length > 0);

  if (successes.length === 0) {
    console.warn("[admin/ocr] all", valid.length, "OCR requests failed, using mock");
    return {
      text: "AQUA, GLYCERIN, NIACINAMIDE, CETEARYL ALCOHOL, BUTYROSPERMUM PARKII BUTTER, PANTHENOL, TOCOPHEROL, PHENOXYETHANOL",
      source: "mock",
    };
  }

  console.log(`[admin/ocr] combined ${successes.length}/${valid.length} successful OCR results`);
  return { text: successes.join(", "), source: "ocr" };
}

interface ProductSuggestion {
  id: string;
  barcode: string;
  product_name: string;
  brand: string;
  category: string | null;
  ingredients_text: string | null;
  front_image_url: string | null;
  ingredients_image_url: string | null;
  ingredients_image_urls: string[] | null;
  status: string;
  created_at: string | null;
}

const PENDING_STATUS = "pending_admin_review";

function getIngredientsImages(item: ProductSuggestion): string[] {
  if (Array.isArray(item.ingredients_image_urls) && item.ingredients_image_urls.length > 0) {
    return item.ingredients_image_urls.filter((u): u is string => typeof u === "string" && u.length > 0);
  }
  if (typeof item.ingredients_image_url === "string" && item.ingredients_image_url.length > 0) {
    return [item.ingredients_image_url];
  }
  return [];
}

export default function AdminProductSuggestionsScreen() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/(tabs)/profil");
    }
  }, [authLoading, isAdmin]);

  if (authLoading) return null;
  if (!isAdmin) return null;

  const [items, setItems] = useState<ProductSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [ocrModal, setOcrModal] = useState<{
    open: boolean;
    suggestionId: string | null;
    imageUrls: string[];
    text: string;
    loading: boolean;
    saving: boolean;
    source: "ocr" | "mock" | null;
  }>({
    open: false,
    suggestionId: null,
    imageUrls: [],
    text: "",
    loading: false,
    saving: false,
    source: null,
  });

  const fetchSuggestions = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("product_suggestions")
      .select(
        "id, barcode, product_name, brand, category, ingredients_text, front_image_url, ingredients_image_url, ingredients_image_urls, status, created_at"
      )
      .eq("status", PENDING_STATUS)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as ProductSuggestion[]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchSuggestions();
      setLoading(false);
    })();
  }, [fetchSuggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuggestions();
    setRefreshing(false);
  }, [fetchSuggestions]);

  const updateStatus = useCallback(
    async (id: string, nextStatus: "approved" | "rejected") => {
      setUpdatingId(id);

      // Approve flow: also insert into products table.
      if (nextStatus === "approved") {
        const { data: row, error: fetchErr } = await supabase
          .from("product_suggestions")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (fetchErr || !row) {
          setUpdatingId(null);
          Alert.alert("Hata", fetchErr?.message ?? "Öneri satırı bulunamadı.");
          return;
        }

        const barcode = (row as ProductSuggestion).barcode;

        const { data: existing, error: dupErr } = await supabase
          .from("products")
          .select("id")
          .eq("barcode", barcode)
          .maybeSingle();

        if (dupErr) {
          setUpdatingId(null);
          Alert.alert("Hata", dupErr.message);
          return;
        }

        const ingredientsText = (row as ProductSuggestion).ingredients_text ?? null;
        const shortBenefit = generateShortBenefit(ingredientsText);

        if (existing) {
          const { error: updateProductErr } = await supabase
            .from("products")
            .update({
              name: (row as ProductSuggestion).product_name,
              brand: (row as ProductSuggestion).brand,
              category: (row as ProductSuggestion).category,
              ingredients: ingredientsText,
              short_benefit: shortBenefit,
            })
            .eq("barcode", barcode);

          if (updateProductErr) {
            setUpdatingId(null);
            console.warn("[admin/approve] products update failed:", updateProductErr);
            Alert.alert("Ürün güncellenemedi", updateProductErr.message);
            return;
          }
          console.log("[admin/approve] updated existing product:", barcode);
        } else {
          const productPayload = {
            name: (row as ProductSuggestion).product_name,
            brand: (row as ProductSuggestion).brand,
            barcode,
            category: (row as ProductSuggestion).category,
            ingredients: ingredientsText,
            image_url: (row as ProductSuggestion).front_image_url,
            short_benefit: shortBenefit,
            created_at: new Date().toISOString(),
          };
          const { error: insertErr } = await supabase
            .from("products")
            .insert(productPayload);

          if (insertErr) {
            setUpdatingId(null);
            console.warn("[admin/approve] products insert failed:", insertErr);
            Alert.alert("Ürün eklenemedi", insertErr.message);
            return;
          }
          console.log("[admin/approve] inserted new product:", barcode);
        }
      }

      const { error: updateError } = await supabase
        .from("product_suggestions")
        .update({ status: nextStatus })
        .eq("id", id);
      setUpdatingId(null);

      if (updateError) {
        Alert.alert("Hata", updateError.message);
        return;
      }
      setItems(prev => prev.filter(it => it.id !== id));
    },
    []
  );

  const openOcr = useCallback(async (suggestionId: string, imageUrls: string[]) => {
    setOcrModal({
      open: true,
      suggestionId,
      imageUrls,
      text: "",
      loading: true,
      saving: false,
      source: null,
    });
    const { text, source } = await runOcrFromUrls(imageUrls);
    setOcrModal(m => (m.suggestionId === suggestionId
      ? { ...m, text, loading: false, source }
      : m
    ));
  }, []);

  const retryOcr = useCallback(async () => {
    if (ocrModal.imageUrls.length === 0 || !ocrModal.suggestionId) return;
    setOcrModal(m => ({ ...m, loading: true, source: null }));
    const { text, source } = await runOcrFromUrls(ocrModal.imageUrls);
    setOcrModal(m => ({ ...m, text, loading: false, source }));
  }, [ocrModal.imageUrls, ocrModal.suggestionId]);

  const closeOcr = useCallback(() => {
    setOcrModal({
      open: false,
      suggestionId: null,
      imageUrls: [],
      text: "",
      loading: false,
      saving: false,
      source: null,
    });
  }, []);

  const saveOcrText = useCallback(async () => {
    if (!ocrModal.suggestionId) return;
    const trimmed = ocrModal.text.trim();
    setOcrModal(m => ({ ...m, saving: true }));
    const { error: updErr } = await supabase
      .from("product_suggestions")
      .update({ ingredients_text: trimmed.length > 0 ? trimmed : null })
      .eq("id", ocrModal.suggestionId);

    if (updErr) {
      setOcrModal(m => ({ ...m, saving: false }));
      Alert.alert("Hata", updErr.message);
      return;
    }
    // Reflect locally so the card shows the new text immediately.
    const id = ocrModal.suggestionId;
    setItems(prev => prev.map(it =>
      it.id === id ? { ...it, ingredients_text: trimmed.length > 0 ? trimmed : null } : it
    ));
    closeOcr();
  }, [ocrModal.suggestionId, ocrModal.text, closeOcr]);

  const renderItem = ({ item }: { item: ProductSuggestion }) => {
    const images = getIngredientsImages(item);
    const isUpdating = updatingId === item.id;

    return (
      <View style={styles.card}>
        <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
        <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Barkod:</Text>
          <Text style={styles.metaValue} selectable>{item.barcode}</Text>
        </View>

        {item.category ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Kategori:</Text>
            <Text style={styles.metaValue}>{item.category}</Text>
          </View>
        ) : null}

        {item.front_image_url ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ön yüz</Text>
            <Image source={{ uri: item.front_image_url }} style={styles.frontImage} resizeMode="contain" />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>İçerik fotoğrafları ({images.length})</Text>
          {images.length === 0 ? (
            <Text style={styles.empty}>Fotoğraf yok</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageStrip}
            >
              {images.map((uri, idx) => (
                <Image
                  key={`${item.id}-img-${idx}`}
                  source={{ uri }}
                  style={styles.ingredientImage}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          )}
        </View>

        {item.ingredients_text ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>İçerik metni</Text>
            <Text style={styles.ingredientsText}>{item.ingredients_text}</Text>
          </View>
        ) : null}

        {images.length > 0 ? (
          <TouchableOpacity
            style={[styles.ocrBtn, isUpdating && styles.actionDisabled]}
            onPress={() => openOcr(item.id, images)}
            disabled={isUpdating}
            activeOpacity={0.75}
          >
            <Text style={styles.ocrBtnText}>İçeriği Çıkar</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, isUpdating && styles.actionDisabled]}
            onPress={() => updateStatus(item.id, "approved")}
            disabled={isUpdating}
            activeOpacity={0.75}
          >
            <Text style={styles.actionText}>Onayla</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, isUpdating && styles.actionDisabled]}
            onPress={() => updateStatus(item.id, "rejected")}
            disabled={isUpdating}
            activeOpacity={0.75}
          >
            <Text style={styles.actionText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>← Geri</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Ürün Önerileri</Text>
      <Text style={styles.subtitle}>Bekleyen incelemeler</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#6B7280" style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Hata: {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.75}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.emptyText}>Bekleyen öneri yok.</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Modal
        visible={ocrModal.open}
        animationType="slide"
        transparent
        onRequestClose={closeOcr}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>İçerik OCR</Text>
            {ocrModal.source === "mock" ? (
              <Text style={styles.modalHint}>OCR servisinden yanıt alınamadı, örnek metin gösteriliyor. Lütfen elle düzelt.</Text>
            ) : ocrModal.source === "ocr" ? (
              <Text style={styles.modalHint}>OCR sonucu — düzelterek kaydedebilirsin.</Text>
            ) : (
              <Text style={styles.modalHint}>İçerik metni çıkarılıyor…</Text>
            )}

            {ocrModal.loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#6B7280" />
              </View>
            ) : (
              <TextInput
                style={styles.modalTextarea}
                value={ocrModal.text}
                onChangeText={t => setOcrModal(m => ({ ...m, text: t }))}
                multiline
                placeholder="İçerikleri buraya yapıştır veya düzelt…"
                placeholderTextColor="#9CA3AF"
                editable={!ocrModal.saving}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeOcr}
                disabled={ocrModal.saving}
                activeOpacity={0.75}
              >
                <Text style={styles.modalBtnTextDark}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalRetry, (ocrModal.loading || ocrModal.saving) && styles.actionDisabled]}
                onPress={retryOcr}
                disabled={ocrModal.loading || ocrModal.saving}
                activeOpacity={0.75}
              >
                <Text style={styles.modalBtnTextDark}>Tekrar dene</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave, (ocrModal.loading || ocrModal.saving) && styles.actionDisabled]}
                onPress={saveOcrText}
                disabled={ocrModal.loading || ocrModal.saving}
                activeOpacity={0.75}
              >
                {ocrModal.saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    color: "#374151",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  loader: {
    marginTop: 40,
  },
  center: {
    alignItems: "center",
    marginTop: 40,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
  },
  list: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  brand: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 2,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: "#6B7280",
    width: 80,
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  frontImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  imageStrip: {
    gap: 8,
    paddingRight: 8,
  },
  ingredientImage: {
    width: 260,
    height: 320,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  empty: {
    fontSize: 13,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  ingredientsText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  approveBtn: {
    backgroundColor: "#059669",
  },
  rejectBtn: {
    backgroundColor: "#DC2626",
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  ocrBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#1F2937",
  },
  ocrBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  modalLoading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTextarea: {
    minHeight: 200,
    maxHeight: 360,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: {
    backgroundColor: "#E5E7EB",
  },
  modalRetry: {
    backgroundColor: "#D1D5DB",
  },
  modalSave: {
    backgroundColor: "#059669",
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  modalBtnTextDark: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
  },
});