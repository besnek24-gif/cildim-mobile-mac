/**
 * intentGuard.ts — LOGIC MIRROR of @workspace/intent-guard
 * (kaynak: lib/intent-guard/src/index.ts)
 *
 * EH20 — Tek niyet/aktif filtreleme katmanı.
 *
 * NEDEN MIRROR:
 *   Expo + Metro bundler pnpm workspace paketleriyle (sembolik link tabanlı)
 *   güvenilir çalışmıyor (web bundle @expo/metro-runtime resolution kırıldı).
 *   Bu yüzden mobile bu modülün LOGIC kopyasını yerelde tutar.
 *
 * GROUND TRUTH:
 *   lib/intent-guard/src/index.ts. Yorum/başlık farklı olabilir; AMA
 *   detectActiveIntent + matchesIntentByText + matchesActiveIntent
 *   FONKSİYON GÖVDELERİ ve required/blockers tabloları AYNEN bu dosyada
 *   olmalı. Parite kontrolü için: `pnpm run check:intent-guard-parity`.
 *
 *   API server tarafı paylaşılan @workspace/intent-guard kütüphanesini
 *   kullanır; mobile bu mirror'ı kullanır. Her iki tarafın da aynı
 *   tabloyu çalıştırması garanti altındadır.
 *
 * Akış:
 *   1) detectActiveIntent(stepName)   → IntentGuard | null
 *   2) matchesIntentByText(text, stepName) → boolean
 *   3) matchesActiveIntent(productLike, stepName) → boolean (V2-shaped uyum)
 */

export interface IntentGuard {
  required: string[];
  blockers?: string[];
}

export function detectActiveIntent(stepName: string): IntentGuard | null {
  const n = (stepName ?? "").toLowerCase();

  // C Vitamini / Aydınlatıcı / Leke
  if (
    n.includes("c vitamin") || n.includes("vitamin c") || n.includes("ascorbic") ||
    n.includes("leke") || n.includes("aydınlat") || n.includes("aydinlat") ||
    n.includes("ton eşit") || n.includes("ton esit") || n.includes("hiperpigment")
  ) {
    return {
      required: [
        "vitamin c", "c vitamin", "ascorbic", "askorbik",
        "niacinamide", "niasinamid",
        "leke", "aydınlat", "aydinlat", "brighten", "brightening", "lightening",
        "ton eşit", "ton esit",
        "tranexamic", "traneksamik",
        "azelaic", "azelaik",
        "alpha arbutin", "arbutin",
        "kojik",
        "spf",
      ],
      blockers: ["hyaluronic", "hyaluron", "hidrasyon"],
    };
  }

  // Retinol / Yaşlanma / Anti-age
  if (
    n.includes("retinol") || n.includes("retinoid") || n.includes("retinal") ||
    n.includes("a vitamin") || n.includes("yaşlanma") || n.includes("yaslanma") ||
    n.includes("anti-age") || n.includes("antiage") || n.includes("anti age") ||
    n.includes("anti-aging") || n.includes("anti aging")
  ) {
    return {
      required: [
        "retinol", "retinoid", "retinal",
        "bakuchiol",
        "peptide", "peptit",
        "kollajen", "collagen",
        "anti-age", "antiage", "anti age", "anti-aging",
        "yaşlanma", "yaslanma",
        "kırışık", "kirisik",
      ],
    };
  }

  // Niacinamide / Gözenek / Yağlılık / Sebum
  if (
    n.includes("niacinamide") || n.includes("niasinamid") || n.includes("niasin") ||
    n.includes("gözenek") || n.includes("gozenek") ||
    n.includes("yağlılık") || n.includes("yaglilik") || n.includes("sebum")
  ) {
    return {
      required: [
        "niacinamide", "niasinamid",
        "zinc", "çinko", "cinko",
        "salicyl", "salisilik",
        "bha",
        "gözenek", "gozenek",
        "sebum",
        "matlaştır", "matlastir",
      ],
    };
  }

  // SPF / Güneş
  if (
    n.includes("spf") || n.includes("güneş") || n.includes("gunes") ||
    n.includes("sunscreen") || n.includes("uv ") || n.includes("mineral filtr")
  ) {
    return {
      required: ["spf", "güneş", "gunes", "uv", "sunscreen", "koruyucu"],
    };
  }

  // Hyaluronic / Nem / Kuruluk / Bariyer
  if (
    n.includes("hyaluron") || n.includes("hiyalüronik") || n.includes("hiyaluronik") ||
    n.includes("nem ") || n.includes("kuruluk") || n.includes("bariyer") ||
    n.includes("dehidrasyon")
  ) {
    return {
      required: [
        "hyaluronic", "hyaluron", "hiyalüronik", "hiyaluronik",
        "ceramide", "seramid", "ceramid",
        "panthenol", "pantenol",
        "nem", "moisturiz", "hidrasyon", "hydrating",
        "bariyer", "barrier", "onarıcı", "onarici", "repair",
        "glycerin", "gliserin",
        "squalane", "skualan",
      ],
    };
  }

  // BHA / AHA / Eksfoliasyon
  if (
    n.includes("bha") || n.includes("aha") || n.includes("pha") ||
    n.includes("eksfoli") || n.includes("peeling") || n.includes("siyah nokta")
  ) {
    return {
      required: [
        "bha", "aha", "pha",
        "salicyl", "salisilik",
        "glikolik", "glycolic",
        "laktik", "lactic",
        "mandelic", "mandelik",
        "exfoli", "eksfoli", "peeling",
      ],
    };
  }

  // Yatıştırıcı / Centella / Hassas
  if (
    n.includes("yatıştır") || n.includes("yatistir") || n.includes("soothing") ||
    n.includes("centella") || n.includes("madecass") || n.includes("kızarık") || n.includes("kizarik")
  ) {
    return {
      required: [
        "centella", "madecassoside", "madecass", "cica",
        "panthenol", "pantenol",
        "allantoin",
        "yatıştır", "yatistir", "soothing", "calm",
        "hassas", "sensitive",
      ],
    };
  }

  return null;
}

export function matchesIntentByText(productText: string, stepName: string): boolean {
  const guard = detectActiveIntent(stepName);
  if (!guard) return true;

  const hay = (productText ?? "").toLowerCase();
  const hasRequired = guard.required.some((kw) => hay.includes(kw.toLowerCase()));
  if (hasRequired) return true;

  if (guard.blockers && guard.blockers.some((kw) => hay.includes(kw.toLowerCase()))) {
    return false;
  }
  return false;
}

export function matchesActiveIntent(
  product: { name?: string | null; short_benefit?: string | null; category?: string | null },
  stepName: string,
): boolean {
  const text = [
    product.name ?? "",
    product.short_benefit ?? "",
    product.category ?? "",
  ].join(" ");
  return matchesIntentByText(text, stepName);
}
