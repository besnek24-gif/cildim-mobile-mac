/**
 * expertVoice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Uygulamanın analitik sesinin merkezi tanımı.
 *
 * Bu sistem bir dermatolojik danışman gibi davranır:
 *   - Dermatoloji bilgisine sahip
 *   - Eczacı bakış açısına hâkim
 *   - Klinik temkinli
 *   - Abartısız ve güvenilir
 *
 * Kurallar:
 *   1. Kesin hüküm YOK — "kesin güvenli", "zararsız", "tehlikeli" gibi mutlak ifadeler yasak
 *   2. Risk varsa belirt — "oluşturabilir", "dikkat gerektirebilir", "risklendiren"
 *   3. Yüksek risk → "eczacıya / hekime danış" önerisi zorunlu
 *   4. Profil varsa profil bazlı konuş, yoksa genel konuş
 *   5. İçerik bazlı gerekçe — "bu bileşen … nedeniyle" yapısı
 *
 * Bu dosya doğrudan metin üretmez; diğer modüllerin kullandığı
 * yardımcılar ve sabitler içerir.
 */

// ── Rol tanımı (belgeleme + gelecekte LLM prompt olarak kullanılabilir) ──────

export const EXPERT_ROLE = `
Sen dermatoloji bilgisine sahip, eczacı bakış açısına hâkim bir dermokozmetik değerlendirme
asistanısın. Kullanıcıya ürünlerin içeriğini, dermatolojik profiline uygunluğunu ve
olası risklerini kısa, net ve klinik temkinli bir dille açıklarsın.

Kesin hüküm vermezsin. Risk varsa her zaman belirtirsin. Gerektiğinde eczacıya veya
hekime başvurulmasını önerirsin. Kullanıcının profili varsa her yorumunda bunu dikkate
alırsın. İçerik bazlı gerekçe gösterirsin.
`.trim();

// ── Yasaklı mutlak ifadeler ──────────────────────────────────────────────────
// Bu kelimelerin verdict/subline metinlerinde KULLANILMAMASI gerekir.

export const FORBIDDEN_ABSOLUTE_CLAIMS = [
  "kesinlikle güvenli",
  "kesin güvenli",
  "tamamen güvenli",
  "zararsız",
  "kesinlikle uygun",
  "kesinlikle önerilir",
  "kesinlikle sakıncalı",
  "tehlikeli",
  "kesinlikle tehlikeli",
  "kullanmayın",           // emir kipi — yerine "önerilmez" kullan
  "kullanılmamalı",        // yerine "dikkatle değerlendirilmeli" kullan (hamile hariç)
] as const;

// ── Hekim / eczacı danış tetikleyicileri ────────────────────────────────────

export type ConsultReason =
  | "pregnancy_retinoid"     // Hamilelik + retinoid / yüksek asit
  | "breastfeeding_retinoid" // Emzirme + retinoid / yüksek asit
  | "allergy_match"          // Kullanıcının bildiği alerjenle çakışma
  | "sensitizer_match"       // Hassaslaştırıcı koruyucu + sensitif cilt
  | "high_risk_combo"        // Rozasea + güçlü irrite edici
  | "unknown_reaction";      // Bilinmeyen reaksiyon / karmaşık tablo

/**
 * Konsültasyon metni döner.
 * Kısa, klinik ve net — tek cümle ya da iki kısa cümle.
 */
export function getConsultationText(reason: ConsultReason): string {
  switch (reason) {
    case "pregnancy_retinoid":
      return "Bu dönemde kullanım için bir kadın doğum uzmanına veya dermatologunuza danışmanızı öneririz.";
    case "breastfeeding_retinoid":
      return "Emzirme döneminde bu aktifler için hekiminize danışmanızı öneririz.";
    case "allergy_match":
      return "İçerik-alerji eşleşmesi saptandı; kullanmadan önce eczacınıza ya da hekiminize danışın.";
    case "sensitizer_match":
      return "Hassaslaştırıcı madde içeriyor; özellikle reaktif ciltlerde eczacıya danışılması önerilir.";
    case "high_risk_combo":
      return "Kışkırtıcı bileşenler hassas profilinizle örtüşüyor; dermatologunuza danışmayı değerlendirin.";
    case "unknown_reaction":
      return "Beklenmedik bir reaksiyon oluşursa ürünü bırakın ve bir dermatologa başvurun.";
  }
}

// ── Risk seviyesi ─────────────────────────────────────────────────────────────

export type ExpertRiskLevel = "none" | "low" | "moderate" | "high";

/**
 * Kullanıcı profili + içerik bayraklarından risk seviyesi hesaplar.
 * CompatibilityTab ve SuitabilityInsights'ın ortak giriş noktası.
 */
export function resolveRiskLevel(params: {
  isPregnant:       boolean;
  isBreastfeeding:  boolean;
  hasRetinoid:      boolean;
  hasHighAcid:      boolean;
  hasSalicylic:     boolean;
  hasFragrance:     boolean;
  hasHarshAlcohol:  boolean;
  hasSensitizer:    boolean;
  hasRosacea:       boolean;
  isSensitive:      boolean;
  allergyMatch:     boolean;
}): ExpertRiskLevel {
  const {
    isPregnant, isBreastfeeding,
    hasRetinoid, hasHighAcid, hasSalicylic,
    allergyMatch,
    hasRosacea, hasSensitizer,
    hasFragrance, hasHarshAlcohol,
    isSensitive,
  } = params;

  // Yüksek risk — hekim referansı zorunlu
  if ((isPregnant || isBreastfeeding) && (hasRetinoid || hasHighAcid || hasSalicylic)) return "high";
  if (allergyMatch) return "high";

  // Orta risk — dikkat mesajı gerekli
  if (hasRosacea && (hasFragrance || hasHarshAlcohol)) return "moderate";
  if (isSensitive && hasSensitizer) return "moderate";
  if (hasRosacea && hasSensitizer)  return "moderate";

  // Düşük risk — genel bilgi
  if (hasFragrance || hasHarshAlcohol) return "low";

  return "none";
}

// ── Güvenli formülasyon yardımcıları ─────────────────────────────────────────

/**
 * Bir uygunluk metnine risk seviyesine göre dipnot ekler.
 * Metin zaten bir caveat içeriyorsa tekrar eklenmez.
 */
export function withRiskFootnote(
  text: string,
  riskLevel: ExpertRiskLevel,
  consultReason?: ConsultReason,
): string {
  if (text.includes("hekiminize") || text.includes("eczacı")) return text;

  if (riskLevel === "high" && consultReason) {
    return text + " " + getConsultationText(consultReason);
  }
  if (riskLevel === "moderate") {
    return text + " Gerekirse eczacınıza danışabilirsiniz.";
  }
  return text;
}

/**
 * Klinik temkinli bir "olumlu" verdict şablonu.
 * Doğrudan "olumlu" yerine kanıta dayalı ama ölçülü bir dil kullanır.
 */
export function clinicalPositive(finding: string): string {
  return `${finding} — bu içerik profili ilgili kaygı için destekleyici nitelikte.`;
}

/**
 * Klinik temkinli bir "dikkat" verdict şablonu.
 */
export function clinicalCaution(finding: string, implication: string): string {
  return `${finding}; ${implication}`;
}

// ── Metin doğrulayıcı (geliştirme ortamı) ────────────────────────────────────

/**
 * Üretilen metnin yasaklı mutlak ifade içerip içermediğini kontrol eder.
 * Yalnızca __DEV__ ortamında çalışır; production'da no-op.
 */
export function devCheckVoice(text: string, context: string): void {
  if (!__DEV__) return;
  for (const forbidden of FORBIDDEN_ABSOLUTE_CLAIMS) {
    if (text.toLowerCase().includes(forbidden)) {
      console.warn(
        `[ExpertVoice] Yasak mutlak ifade tespit edildi — "${forbidden}" — bağlam: ${context}`,
      );
    }
  }
}
