import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Text } from "react-native";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

const MAX_WORDS = 15;

function trimToWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(" ") + "…";
}

// E4/F13 — Stabil short_benefit display çözümleyici.
// AUDIT (F13):
//   Bug 1 (data): NormalizedProduct.shortBenefit, Supabase background
//     hydration sonrası null'a düşebiliyordu. consumeNavigationProduct() ile
//     gelen lightweight Home snapshot'ta `short_benefit` veya `description`
//     dolu → ilk render'da box dolu. fetchSupabaseProductById() full row
//     ile setProduct(full) yapınca, eğer full row'da `short_benefit` null
//     VE `description`'tan detectEffect bir etki yakalayamıyorsa
//     generateShortBenefit() null döner → normalizedProduct.shortBenefit = null
//     → BenefitCard `if (!raw) return null` ile yok olur. Favori toggle ile
//     aynı anda gerçekleşince kullanıcı "favori sildi" olarak algılar.
//   Bug 2 (animation): useEffect(() => {...}, []) EMPTY deps array;
//     opacity Animated.Value(0)'da başlar; mount sırasında raw null ise
//     entrance animation hiç tetiklenmez; sonradan raw dolsa bile useEffect
//     re-fire etmez → opacity 0'da kalır → metin görünmez.
//   Bug 3 (wrapper): OverviewPipeline'daki <View marginBottom:16> wrapper,
//     BenefitCard null dönse bile 16px boşluk bırakıyor. Bu fix marginBottom
//     sorumluluğunu BenefitCard'a alır → null dönüşte boşluk da gider.
// FIX:
//   1. getDisplayShortBenefit fallback chain: shortBenefit → benefits[0] →
//      extraInfo → about. NormalizedProduct alanları (raw product değil).
//   2. useEffect deps'e [displayShortBenefit] eklendi → raw doluna geçince
//      animation otomatik tetiklenir.
//   3. marginBottom:16 BenefitCard'ın kendi Animated.View'ine taşındı →
//      null return'de boşluk yok.
// PROTECTION: NormalizedProduct schema, normalizeProduct.ts,
//             generateShortBenefit, OverviewPipeline pipeline mimarisi,
//             Supabase query, favorite hook DEĞİŞMEDİ. Sadece display
//             layer'da fallback + animation kararlılığı.
export function getDisplayShortBenefit(product: NormalizedProduct | null | undefined): string {
  if (!product) return "";

  // 1. Primary: NormalizedProduct'ın hesaplanmış shortBenefit'i
  const direct = product.shortBenefit;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  // 2. Fallback: ilk anlamlı benefit
  if (Array.isArray(product.benefits)) {
    const first = product.benefits.find(
      (b) => typeof b === "string" && b.trim().length > 0
    );
    if (first) return first.trim();
  }

  // 3. Fallback: extraInfo (normalizeProduct'tan, shortDesc karşılığı)
  const extra = (product as any)?.extraInfo;
  if (typeof extra === "string" && extra.trim().length > 0) {
    return extra.trim();
  }

  // 4. Son çare: about (full description) — trimToWords ile zaten kısalır
  const about = product.about;
  if (typeof about === "string" && about.trim().length > 0) {
    return about.trim();
  }

  return "";
}

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
}

export function BenefitCard({ product, isDark }: Props) {
  // E4/F13 — Stabil display fallback chain
  const displayShortBenefit = useMemo(
    () => getDisplayShortBenefit(product),
    [
      product?.id,
      product?.shortBenefit,
      product?.benefits,
      (product as any)?.extraInfo,
      product?.about,
    ]
  );

  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  // E4/F13 — Animation deps: displayShortBenefit dahil. Önceki versiyonda
  // empty deps array vardı; raw mount'ta null ise animation hiç başlamıyordu.
  useEffect(() => {
    if (!displayShortBenefit) return;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    // opacity / translateY referansları ref'tedir, deps'e eklemeye gerek yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayShortBenefit]);

  if (!displayShortBenefit) return null;

  const text = trimToWords(displayShortBenefit, MAX_WORDS);

  const bg     = isDark ? "#2A3820" : "#EAF1EA";
  const border = isDark ? "#3A4D30" : "#B8CEB8";
  const tc     = isDark ? "#9DB88D" : "#5C7050";

  return (
    <Animated.View style={{
      // E4/F13 — marginBottom BenefitCard'a taşındı: null dönüşte parent'ta
      // boşluk kalmasın diye. OverviewPipeline'daki wrapper View kaldırıldı.
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: bg,
      borderColor: border,
      opacity,
      transform: [{ translateY }],
    }}>
      <Feather name="zap" size={15} color={isDark ? "#9DB88D" : "#7A8F6B"} style={{ marginTop: 2 }} />
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.9}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "600",
          lineHeight: 20,
          letterSpacing: 0.2,
          color: tc,
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}
