import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";
import { derivePurposeTag } from "@/lib/featureBadges";

/**
 * ProductAboutSection
 * ─────────────────────────────────────────────────────────────────────────────
 * Bu bölüm HER ZAMAN görünür — hiçbir üründe kaybolmaz.
 *
 * Metin kaynağı önceliği:
 *   1. product.about (full_description / description / aciklama)
 *   2. product.extraInfo (short_description — about'tan farklıysa)
 *   3. Otomatik fallback: shortBenefit + category + segment + usageInstructions
 *
 * Uzunluk kuralı:
 *   • 200+ karakter → 4 satır kırpılmış + "Devamını Gör" toggle
 *   • Kısa metin     → olduğu gibi gösterilir
 */

const COLLAPSE_LEN = 200;

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textSecondary: string;
}

// ── Fallback metin üretici ─────────────────────────────────────────────────
function buildAboutText(product: NormalizedProduct): string {
  // 1. Uzun açıklama varsa kullan
  if (product.about && product.about.trim().length >= 30) {
    return product.about.trim();
  }

  // 2. Kısa açıklama varsa onu al, fallback ile güçlendir
  const baseFromShort =
    product.about && product.about.trim().length > 0
      ? product.about.trim()
      : null;

  // Materyaller
  const benefit   = product.shortBenefit?.trim() ?? null;
  const category  = product.category?.trim() ?? null;
  const sub       = product.subcategory?.trim() ?? null;
  const brand     = product.brand?.trim() ?? null;
  const usage     = product.usageInstructions?.trim() ?? null;
  const segment   = product.segment ?? null;
  const extra     = product.extraInfo?.trim() ?? null;

  const parts: string[] = [];

  // A) Kısa açıklama başa koy
  if (baseFromShort) parts.push(endDot(baseFromShort));

  // B) short_benefit → açıklayıcı
  if (benefit && benefit.length > 15 && !baseFromShort) {
    parts.push(endDot(benefit));
  }

  // C) Kategori / alt kategori kimlik cümlesi (henüz hiçbir şey yoksa)
  if (parts.length === 0) {
    const catRaw  = sub || category;
    // Ham İngilizce kategori key'ini (ör. "moisturizer") Türkçe'ye çevir
    const catPart = catRaw ? (derivePurposeTag(catRaw) ?? catRaw) : null;
    const brandStr = brand ? `${brand} markasına ait bu ürün` : "Bu ürün";
    if (catPart) {
      parts.push(`${brandStr}, ${catPart.toLowerCase()} kategorisinde yer alan bir cilt bakım ürünüdür.`);
    } else {
      parts.push(`${brandStr} günlük cilt bakım rutininizi desteklemek için tasarlanmıştır.`);
    }
  }

  // D) Segment niteliği (zaten bir şeyler varsa ekle)
  if (parts.length > 0) {
    if (segment === "seckin") {
      parts.push("Seçkin serisi kapsamında özel olarak formüle edilmiştir.");
    } else if (segment === "profesyonel") {
      parts.push("Dermatoloji odaklı profesyonel bir formüle sahiptir.");
    } else if (segment === "ekonomik") {
      parts.push("Günlük kullanıma uygun, bütçe dostu bir seçenektir.");
    }
  }

  // E) Kullanım talimatı (kısa ve anlamlıysa)
  if (usage && usage.length > 10 && usage.length <= 140 && !parts.some(p => p.includes(usage))) {
    parts.push(endDot(usage));
  }

  // F) extra_info (farklıysa)
  if (extra && extra.length > 15 && !parts.some(p => p.includes(extra))) {
    parts.push(endDot(extra));
  }

  // G) Son çare
  if (parts.length === 0) {
    const brandStr = brand ? `${brand} ` : "";
    parts.push(`${brandStr}ürünü cilt bakım rutininizi desteklemek için tasarlanmıştır.`);
  }

  return parts.join(" ").trim();
}

function endDot(s: string): string {
  return /[.!?]$/.test(s) ? s : s + ".";
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProductAboutSection({
  product,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
}: Props) {
  const description = buildAboutText(product);
  const [expanded, setExpanded] = useState(false);

  const isLong    = description.length > COLLAPSE_LEN;
  const showToggle = isLong;

  const accent      = isDark ? "#60A5FA" : "#2563EB";
  const accentMuted = isDark ? "#1E3A5F" : "#BFDBFE";

  return (
    <View
      style={{
        borderRadius: PD.radius.lg,
        borderWidth: PD.card.borderWidth,
        padding: PD.card.padding,
        backgroundColor: cardBg,
        borderColor: cardBorder,
        gap: PD.spacing.sm,
      }}
    >
      {/* Başlık */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Feather name="info" size={14} color={accent} />
        <Text style={[PD.font.sectionTitle, { color: textColor }]}>Ürün Hakkında</Text>
      </View>

      {/* Metin */}
      <Text
        style={[PD.font.body, { color: textSecondary, lineHeight: 22 }]}
        numberOfLines={expanded || !showToggle ? undefined : 4}
      >
        {description}
      </Text>

      {/* Toggle */}
      {showToggle && (
        <TouchableOpacity
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            paddingTop: 2,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: accent }}>
            {expanded ? "Daha Az Göster" : "Devamını Gör"}
          </Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={12}
            color={accent}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
