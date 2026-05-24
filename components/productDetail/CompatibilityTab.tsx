/**
 * CompatibilityTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Uygunluk sekmesi — katmanlı free/seçkin yapı.
 *
 * FREE  : Genel karar · Kimler uygun · Akıllı uyarılar · Kullanım ·
 *         Hamilelik/emzirme genel durumu · Çakışma özeti (teaser)
 * SEÇKİN: + Detaylı uygunluk analizi · Tam ingrediyen çakışma detayı
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import type { IngredientSummary, ParsedIngredient } from "@/lib/ingredientAnalysis";
import {
  getSuitabilitySummary,
  getSuitableFor,
  getCautionFor,
  getUsageProfile,
  getSuitabilityReasons,
  getSeckinDepthNotes,
  type InsightPreferences,
  type SeckinDepthNote,
} from "@/lib/suitabilityInsights";
import type { UserRole } from "@/lib/rbac";
import type { PreferencesSlice } from "@/lib/recommendationReason";
import { PremiumTeaserBlock } from "@/components/PremiumTeaserBlock";
import type { SmartWarning } from "@/lib/smartWarnings";
import {
  warningLevelColor,
  warningLevelIcon,
  warningLevelBg,
  warningLevelBorder,
} from "@/lib/smartWarnings";
import type { IngredientAlert, SafetyEval } from "@/lib/ingredientAlerts";
import {
  safetyStatusColor,
  safetyStatusIcon,
  alertLevelColor,
  alertLevelBg,
  alertLevelBorder,
} from "@/lib/ingredientAlerts";
import { getPharmacistCard } from "@/lib/pharmacistCard";

function toTrUpper(s: string): string {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  product: any;
  parsedIngredients: ParsedIngredient[];
  ingredientSummary: IngredientSummary;
  detectedAllergens: string[];
  pregnancyInfo: { label: string; color: string; icon: string } | null;
  breastfeedingInfo: { label: string; color: string; icon: string } | null;
  productSafetyNotes: string[];
  preferences: PreferencesSlice;
  effectiveRole: UserRole;
  isDark: boolean;
  smartWarnings?: SmartWarning[];
  hasProfile?: boolean;
  /** İçerik eşleştirme motoru çıktısı (alerji/kaçınma çakışmaları) */
  ingredientAlerts?: IngredientAlert[];
  /** Hamilelik güvenlik değerlendirmesi (null = kullanıcı hamile değil) */
  pregnancyStatus?: SafetyEval | null;
  /** Emzirme güvenlik değerlendirmesi (null = kullanıcı emzirmiyor) */
  breastfeedingStatus?: SafetyEval | null;
  /** Çocuk kullanım notu (null = for_child seçili değil) */
  forChildNote?: string | null;
}

// ── Alt bileşenler ────────────────────────────────────────────────────────────

function SectionLabel({ text, icon, color }: { text: string; icon: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <Feather name={icon as any} size={12} color={color} />
      <Text style={{ fontSize: 10, fontWeight: "700", color, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {toTrUpper(text)}
      </Text>
    </View>
  );
}

function Bullet({ text, color, iconName = "check" }: { text: string; color: string; iconName?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
      <View style={{
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: `${color}18`,
        alignItems: "center", justifyContent: "center",
        marginTop: 1, flexShrink: 0,
      }}>
        <Feather name={iconName as any} size={9} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
        {text}
      </Text>
    </View>
  );
}

/** Tek akıllı uyarı chip'i */
function SmartWarnChip({ warn }: { warn: SmartWarning }) {
  const bg     = warningLevelBg(warn.level);
  const border = warningLevelBorder(warn.level);
  const color  = warningLevelColor(warn.level);
  const icon   = warningLevelIcon(warn.level);

  return (
    <View style={[styles.warnChip, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon as any} size={13} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, color, lineHeight: 18 }}>
          {warn.message}
        </Text>
        {warn.boostedByProfile && (
          <Text style={{ fontSize: 11, color, opacity: 0.75, marginTop: 2, fontWeight: "600" }}>
            Şahsî profilinize göre öncelikli
          </Text>
        )}
      </View>
    </View>
  );
}

/** Hamilelik/emzirme/çocuk durum satırı */
function SafetyStatusRow({
  emoji,
  label,
  eval: ev,
}: {
  emoji: string;
  label: string;
  eval: SafetyEval;
}) {
  const color = safetyStatusColor(ev.status);
  const icon  = safetyStatusIcon(ev.status);
  return (
    <View style={[styles.statusRow, { backgroundColor: `${color}12`, borderColor: `${color}35` }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Text style={{ fontSize: 13 }}>{emoji}</Text>
        <Feather name={icon as any} size={12} color={color} />
        <Text style={{ fontSize: 12, fontWeight: "700", color }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 12.5, color, opacity: 0.85, lineHeight: 18 }}>
        {ev.message}
      </Text>
    </View>
  );
}

/** Seçkin içerik çakışma satırı */
function AlertRow({ alert }: { alert: IngredientAlert }) {
  const bg     = alertLevelBg(alert.level);
  const border = alertLevelBorder(alert.level);
  const color  = alertLevelColor(alert.level);
  const icon   = alert.level === "high" ? "alert-triangle" : "alert-circle";

  return (
    <View style={[styles.alertRow, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon as any} size={12} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color }}>
          {alert.type === "allergy_match" ? "Alerji Eşleşmesi" : "Kaçınma Listesi"}
          {" · "}
          <Text style={{ fontWeight: "400" }}>{alert.ingredient}</Text>
        </Text>
        {alert.matchedUserEntry && alert.matchedUserEntry.toLowerCase() !== alert.ingredient.toLowerCase() && (
          <Text style={{ fontSize: 11.5, color, opacity: 0.75, marginTop: 1 }}>
            Girişiniz: "{alert.matchedUserEntry}" → eşleşti: {alert.ingredient}
          </Text>
        )}
        <Text style={{ fontSize: 12, color, opacity: 0.8, marginTop: 3, lineHeight: 17 }}>
          {alert.message}
        </Text>
      </View>
    </View>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export function CompatibilityTab({
  product,
  parsedIngredients,
  ingredientSummary,
  detectedAllergens,
  pregnancyInfo,
  breastfeedingInfo,
  productSafetyNotes,
  preferences,
  effectiveRole,
  isDark,
  smartWarnings = [],
  hasProfile = false,
  ingredientAlerts = [],
  pregnancyStatus = null,
  breastfeedingStatus = null,
  forChildNote = null,
}: Props) {
  const colors = useColors();
  const isSeckin = effectiveRole === "seckin";

  const insightPrefs: InsightPreferences = {
    skinType:           preferences.skinType as string | null,
    skinConcerns:       preferences.skinConcerns as string[],
    specialConditions:  preferences.specialConditions as string[],
    allergies:          preferences.allergies as string[],
  };

  const pharmacistCard = getPharmacistCard(product, parsedIngredients, hasProfile ? insightPrefs : undefined);

  const summary      = getSuitabilitySummary(ingredientSummary, parsedIngredients, hasProfile ? insightPrefs : undefined);
  const suitableFor  = getSuitableFor(product, parsedIngredients, (product?.badges as any[]) ?? []);
  const cautionFor   = getCautionFor(product, parsedIngredients);
  const usageProfile = getUsageProfile(product, parsedIngredients, ingredientSummary, hasProfile ? insightPrefs : undefined);
  const premiumReasons = getSuitabilityReasons(
    product,
    ingredientSummary,
    parsedIngredients,
    {
      skinType:     preferences.skinType as any,
      skinConcerns: preferences.skinConcerns as any,
      allergies:    preferences.allergies,
    },
  );

  const seckinDepthNotes: SeckinDepthNote[] = isSeckin
    ? getSeckinDepthNotes(parsedIngredients, {
        skinType:          preferences.skinType as string | undefined,
        skinConcerns:      preferences.skinConcerns as string[],
        specialConditions: preferences.specialConditions as string[],
      })
    : [];

  const topSensitive = smartWarnings.filter((w) => w.level === "sensitive");
  const topCaution   = smartWarnings.filter((w) => w.level === "caution");
  const topInfo      = smartWarnings.filter((w) => w.level === "info");
  const orderedWarns = [...topSensitive, ...topCaution, ...topInfo];
  const hasCautionContent = orderedWarns.length > 0 || cautionFor.length > 0;

  // Güvenlik bölümü var mı?
  const hasPregnancySection = pregnancyStatus !== null || breastfeedingStatus !== null || forChildNote !== null;
  const hasPersonalList = ingredientAlerts.length > 0;
  const hasSecuritySection = hasPregnancySection || hasPersonalList;

  const cardBg      = isDark ? "#111827" : "#FFFFFF";
  const cardBorder  = isDark ? "#1F2937" : "#F3F4F6";
  const seckinColor = "#B87333";

  return (
    <View style={styles.container}>

      {/* ── Şahsî profil rozeti ─────────────────────────────────────────── */}
      {hasProfile && (
        <TouchableOpacity
          style={[styles.profileBadge, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: isDark ? "#312E81" : "#C7D2FE" }]}
          onPress={() => router.push("/profil-kur" as any)}
          activeOpacity={0.8}
        >
          <Feather name="user" size={12} color={isDark ? "#A5B4FC" : "#4338CA"} />
          <Text style={{ fontSize: 11.5, fontWeight: "600", color: isDark ? "#A5B4FC" : "#4338CA", flex: 1 }}>
            Şahsî profiline göre değerlendirme
          </Text>
          <Feather name="edit-2" size={11} color={isDark ? "#818CF8" : "#6366F1"} />
        </TouchableOpacity>
      )}

      {/* ── Eczacı Kartı ─────────────────────────────────────────────────── */}
      <View style={[styles.card, {
        backgroundColor: isDark ? "#0D1117" : "#FAFAF8",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E8E2D8",
      }]}>
        {/* Başlık */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 9,
            backgroundColor: isDark ? "rgba(184,115,51,0.15)" : "rgba(184,115,51,0.1)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Feather name="user" size={13} color="#B87333" />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "800", color: "#B87333", letterSpacing: 0.6 }}>
            {toTrUpper("Eczacı Yorumu")}
          </Text>
        </View>

        {/* 3 satır */}
        <View style={{ gap: 10 }}>
          {/* Uyumluluk */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              backgroundColor: isDark ? "rgba(5,150,105,0.15)" : "rgba(5,150,105,0.08)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name="shield" size={11} color="#7A8F6B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#7A8F6B", marginBottom: 2, letterSpacing: 0.2 }}>
                Uyumluluk
              </Text>
              <Text style={{ fontSize: 13, color: isDark ? "#C8D8C8" : "#5C7050", lineHeight: 18, fontWeight: "500" }}>
                {pharmacistCard.compatibility}
              </Text>
            </View>
          </View>

          {/* Ayraç */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#EDE8E0" }} />

          {/* Fayda */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.07)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name="zap" size={11} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#2563EB", marginBottom: 2, letterSpacing: 0.2 }}>
                Ne Yapar
              </Text>
              <Text style={{ fontSize: 13, color: isDark ? "#BFDBFE" : "#1E3A5F", lineHeight: 18, fontWeight: "500" }}>
                {pharmacistCard.benefit}
              </Text>
            </View>
          </View>

          {/* Ayraç */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#EDE8E0" }} />

          {/* Dürüst Not */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              backgroundColor: isDark ? "rgba(217,119,6,0.15)" : "rgba(217,119,6,0.08)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name="info" size={11} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706", marginBottom: 2, letterSpacing: 0.2 }}>
                Dürüst Not
              </Text>
              <Text style={{ fontSize: 13, color: isDark ? "#FDE68A" : "#78350F", lineHeight: 18, fontWeight: "500" }}>
                {pharmacistCard.honestNote}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── 0. Şahsi alerjen uyarısı (eski sistem) ─────────────────────── */}
      {detectedAllergens.length > 0 && (
        <View style={[styles.alertCard, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
          <Feather name="alert-triangle" size={16} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: "#b91c1c" }]}>Şahsî Alerjen Uyarısı</Text>
            <Text style={[styles.alertDesc, { color: "#991b1b" }]}>
              Bu ürün belirlediğin alerjenleri içeriyor: {detectedAllergens.join(", ")}
            </Text>
          </View>
        </View>
      )}

      {/* ── 0c. Ürün güvenlik notları ───────────────────────────────────── */}
      {productSafetyNotes.length > 0 && (
        <View style={{ gap: 6 }}>
          {productSafetyNotes.map((note, i) => (
            <View key={i} style={[styles.safetyNote, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <Feather name="alert-triangle" size={12} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
              <Text style={{ flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 }}>{note}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── 1. Genel Uygunluk Sonucu ─────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: `${summary.color}10`, borderColor: `${summary.color}30` }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[styles.verdictDot, { backgroundColor: summary.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: summary.color, lineHeight: 20 }}>
              {summary.verdict}
            </Text>
            {summary.subline ? (
              <Text style={{ fontSize: 12, color: isDark ? "#9CA3AF" : "#6B7280", marginTop: 3, lineHeight: 17 }}>
                {summary.subline}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── NEW: Güvenlik ve Özel Durumlar ───────────────────────────────── */}
      {hasSecuritySection && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <SectionLabel text="Güvenlik ve Özel Durumlar" icon="shield" color="#6D28D9" />

          {/* Hamilelik durumu */}
          {pregnancyStatus && (
            <SafetyStatusRow emoji="🤱" label="Hamilelik" eval={pregnancyStatus} />
          )}

          {/* Emzirme durumu */}
          {breastfeedingStatus && (
            <SafetyStatusRow emoji="🍼" label="Emzirme" eval={breastfeedingStatus} />
          )}

          {/* Çocuk kullanım notu */}
          {forChildNote && (
            <View style={[styles.statusRow, { backgroundColor: "#EAF1EA", borderColor: "#B8CEB8" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 13 }}>👶</Text>
                <Feather name="info" size={12} color="#7A8F6B" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#7A8F6B" }}>Çocuk İçin Kullanım</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: "#5C7050", opacity: 0.85, lineHeight: 18 }}>
                {forChildNote}
              </Text>
            </View>
          )}

          {/* Şahsî içerik çakışmaları */}
          {hasPersonalList && (
            <>
              {(pregnancyStatus || breastfeedingStatus || forChildNote) && (
                <View style={[styles.divider, { backgroundColor: cardBorder, marginVertical: 10 }]} />
              )}

              {isSeckin ? (
                /* Seçkin: tam detay */
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Feather name="star" size={11} color={seckinColor} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: seckinColor, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {toTrUpper("Şahsî Liste Çakışmaları")}
                    </Text>
                  </View>
                  {ingredientAlerts.map((alert, i) => (
                    <AlertRow key={i} alert={alert} />
                  ))}
                </View>
              ) : (
                /* Free: eşleşme TİPİ açık, bileşen adı + detay seçkinde */
                (() => {
                  const allergyCount = ingredientAlerts.filter(a => a.type === "allergy_match").length;
                  const avoidCount   = ingredientAlerts.filter(a => a.type === "avoided_match").length;
                  const matchText =
                    allergyCount > 0 && avoidCount > 0
                      ? `Alerji ve kaçınma listelerinizde toplam ${ingredientAlerts.length} eşleşme tespit edildi.`
                      : allergyCount > 0
                        ? allergyCount === 1
                          ? "Alerji listenizde işaretlediğiniz bir maddeyle bu üründe eşleşme tespit edildi."
                          : `Alerji listenizde ${allergyCount} eşleşme tespit edildi.`
                        : avoidCount === 1
                          ? "Kaçınma listenizde bir maddeyle bu üründe eşleşme tespit edildi."
                          : `Kaçınma listenizde ${avoidCount} eşleşme tespit edildi.`;

                  return (
                    <View style={{
                      backgroundColor: isDark ? "#2D1B0E" : "#FFF7ED",
                      borderColor:     isDark ? "#92400E" : "#FDE68A",
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Feather name="alert-circle" size={13} color="#D97706" />
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {toTrUpper("Şahsî Eşleşme Tespit Edildi")}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: isDark ? "#FDBA74" : "#92400E", lineHeight: 19 }}>
                        {matchText}
                      </Text>
                      <TouchableOpacity
                        style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5 }}
                        onPress={() => router.push("/ayarlar" as any)}
                        activeOpacity={0.7}
                      >
                        <Feather name="star" size={11} color="#B87333" />
                        <Text style={{ fontSize: 12, color: "#B87333", fontWeight: "600" }}>
                          Hangi bileşen, neden dikkat? Şahsî analizi aç
                        </Text>
                        <Feather name="chevron-right" size={11} color="#B87333" />
                      </TouchableOpacity>
                    </View>
                  );
                })()
              )}
            </>
          )}

          {/* Şahsi listem boşsa ve profil varsa CTA */}
          {!hasPersonalList && !hasPregnancySection && hasProfile && (
            <TouchableOpacity
              style={[styles.profileCta, { borderColor: "#6D28D9" }]}
              onPress={() => router.push("/alerji-listesi" as any)}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={12} color="#6D28D9" />
              <Text style={{ fontSize: 12, color: "#6D28D9", fontWeight: "600" }}>
                Şahsî alerji/kaçınma listesi ekle
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* CTA: profil yoksa → güvenlik bölümü için davet */}
      {!hasProfile && (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: isDark ? "#312E81" : "#C7D2FE", flexDirection: "row", alignItems: "center", gap: 10 }]}
          onPress={() => router.push("/profil-kur" as any)}
          activeOpacity={0.85}
        >
          <Feather name="shield" size={16} color={isDark ? "#A5B4FC" : "#4338CA"} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#A5B4FC" : "#4338CA" }}>
              Şahsîleştirilmiş güvenlik analizi
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? "#818CF8" : "#6366F1", marginTop: 2 }}>
              Profil oluştur → hamilelik, alerji ve hassasiyet değerlendirmesi
            </Text>
          </View>
          <Feather name="arrow-right" size={14} color={isDark ? "#818CF8" : "#6366F1"} />
        </TouchableOpacity>
      )}

      {/* ── 2. Kimler İçin Uygun ─────────────────────────────────────────── */}
      {suitableFor.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <SectionLabel text="Kimler İçin Uygun" icon="users" color="#6B7F5D" />
          {suitableFor.map((item, i) => (
            <Bullet key={i} text={item} color="#6B7F5D" iconName="check" />
          ))}
        </View>
      )}

      {/* ── 3. Dikkat Gereken Noktalar (Akıllı Uyarılar + Kimler Dikkatli) ── */}
      {hasCautionContent && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <SectionLabel text="Dikkat Gereken Noktalar" icon="alert-circle" color="#d97706" />

          {orderedWarns.length > 0 && (
            <View style={{ gap: 8, marginBottom: cautionFor.length > 0 ? 10 : 0 }}>
              {orderedWarns.map((w, i) => (
                <SmartWarnChip key={i} warn={w} />
              ))}
            </View>
          )}

          {cautionFor.length > 0 && orderedWarns.length > 0 && (
            <View style={[styles.divider, { backgroundColor: cardBorder }]} />
          )}
          {cautionFor.map((item, i) => (
            <Bullet key={i} text={item} color="#d97706" iconName="alert-circle" />
          ))}
        </View>
      )}

      {/* ── 4. Kullanım Profili ───────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <SectionLabel text="Kullanım Profili" icon="clock" color={colors.primary} />
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
          {usageProfile}
        </Text>
      </View>

      {/* ── 5. Şahsî Değerlendirme (PREMIUM) ────────────────────────────── */}
      {isSeckin ? (
        <View style={[styles.card, { backgroundColor: `${seckinColor}08`, borderColor: `${seckinColor}30` }]}>
          {/* Başlık */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <Feather name="star" size={13} color={seckinColor} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: seckinColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {toTrUpper("Şahsî Değerlendirme")}
            </Text>
          </View>

          {/* Profil-tabanlı uygunluk gerekçeleri */}
          {premiumReasons.length > 0
            ? premiumReasons.map((reason, i) => (
                <Bullet key={i} text={reason} color={seckinColor} iconName="check" />
              ))
            : (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: isDark ? "#9CA3AF" : "#6B7280", lineHeight: 18, marginBottom: 8 }}>
                  Cilt profili bilgileriniz eklendiğinde bu ürün için şahsî değerlendirme burada görünür.
                </Text>
                <TouchableOpacity
                  style={[styles.profileCta, { borderColor: seckinColor }]}
                  onPress={() => router.push("/profil-kur" as any)}
                  activeOpacity={0.8}
                >
                  <Feather name="user" size={12} color={seckinColor} />
                  <Text style={{ fontSize: 12, color: seckinColor, fontWeight: "600" }}>
                    Cilt profilimi oluştur
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }

          {/* Seçkin derinlik notları: kullanım nüansı + içerik + alternatif */}
          {seckinDepthNotes.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: `${seckinColor}25`, marginVertical: 12 }]} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <Feather name="layers" size={11} color={seckinColor} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: seckinColor, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {toTrUpper("Kullanım Nüansları")}
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                {seckinDepthNotes.map((note, i) => {
                  const catColor =
                    note.category === "alternatif" ? "#0284C7" :
                    note.category === "içerik"     ? "#7C3AED" :
                    seckinColor;
                  const catLabel =
                    note.category === "alternatif" ? "Alternatif" :
                    note.category === "içerik"     ? "İçerik Notu" :
                    "Kullanım";
                  return (
                    <View key={i} style={{
                      backgroundColor: isDark ? `${catColor}18` : `${catColor}10`,
                      borderColor:     `${catColor}35`,
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 }}>
                        <Feather name={note.icon as any} size={11} color={catColor} />
                        <Text style={{ fontSize: 10, fontWeight: "700", color: catColor, textTransform: "uppercase", letterSpacing: 0.3 }}>
                          {toTrUpper(catLabel)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12.5, color: isDark ? "#E5E7EB" : "#374151", lineHeight: 18 }}>
                        {note.text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : (
        <PremiumTeaserBlock
          isDark={isDark}
          title="Şahsî Değerlendirme"
          icon="layers"
          previewText={
            premiumReasons.length > 0
              ? premiumReasons[0]
              : "Bu ürünün sizin cilt yapınızdaki etki profili, içerik-profil eşleşmesi ve kullanım nüansları değerlendirmede yer alıyor…"
          }
          lockedLabel="Cilt tipiniz, özel koşullarınız ve alerji listenize göre hazırlanmış tam değerlendirme şahsî katmanda görünür."
          ctaLabel="Şahsî Değerlendirmemi Aç"
          onPress={() => router.push("/ayarlar" as any)}
        />
      )}
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },

  profileBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },

  alertCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "flex-start",
  },
  alertTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  alertDesc:  { fontSize: 12, lineHeight: 17 },

  safetyNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  statusRow: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  alertRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  verdictDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
    marginTop: 2,
  },

  warnChip: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  divider: {
    height: 1,
    marginVertical: 4,
  },

  profileCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
});
