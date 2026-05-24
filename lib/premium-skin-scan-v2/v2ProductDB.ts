/**
 * v2ProductDB — Supabase ürün sorguları (premium-skin-scan-v2 modülü)
 *
 * KATEGORİ-KİLİTLİ MİMARİ:
 *   Her rutin adımı yalnızca kendi doğru alt kategorisinden ürün gösterir.
 *   Güneş koruyucu adımı → sadece güneş koruyucu ürünler.
 *   Temizleyici adımı → sadece temizleyici ürünler. Asla karışmaz.
 *
 * Akış:
 *   1. Adım adından kategori grubu çıkar (getStepCategoryAnchors)
 *   2. Supabase'e category kolonu filtreleyerek sorg gönder
 *   3. İstemci tarafı relevance scoring ile sırala
 *   4. Hard validation: yanlış kategorideki ürünleri at
 *   5. Segment dağılımı: 4 ekonomik / 4 profesyonel / 2 seçkin
 */

import { supabase } from "@/lib/supabaseClient";
import { matchesActiveIntent } from "@/lib/intentGuard";

// EH20 · Niyet/aktif filtreleme @/lib/intentGuard'dan gelir; bu dosya
// lib/intent-guard/src/index.ts'in birebir mirror'ıdır (Expo Metro pnpm
// workspace paketleriyle uyumsuz olduğu için kopya tutuluyor).
// API server tarafı paylaşılan @workspace/intent-guard kütüphanesini kullanır.
// İki kaynağın AYNI tabloyu çalıştırması garanti.
// Geriye uyumluluk için aynı isimle re-export ediyoruz.
export { matchesActiveIntent };

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface V2DBProduct {
  id:             string;
  name:           string;
  brand?:         string;
  short_benefit?: string | null;
  category?:      string;
  segment?:       string;
  image_url?:     string | null;
  thumbnail_url?: string | null;
  /** DB'de mevcut değil — geriye dönük uyumluluk */
  usage_time?:    string;
}

export interface V2Alternatives {
  ekonomik:    V2DBProduct[];
  profesyonel: V2DBProduct[];
  seckin:      V2DBProduct[];
}

/** Ürün için en uygun görseli döner (thumbnail öncelikli). */
export function getProductImageUri(p: V2DBProduct): string | null {
  return p.thumbnail_url ?? p.image_url ?? null;
}

// ─── SELECT string ────────────────────────────────────────────────────────────

const PRODUCT_SELECT = "id, name, brand, short_benefit, category, segment, image_url, thumbnail_url, badges";

// ─── Kategori Grupları ────────────────────────────────────────────────────────

/**
 * Her kategori grubunu tanımlar.
 * DB'deki category kolonunda ILIKE ile eşleştirilir.
 * Ürün bu kategorilerden birinde değilse GÖSTERİLMEZ.
 */
const CATEGORY_ANCHORS: Record<string, string[]> = {
  cleanser:      ["temizleyici", "cleanser", "cleansing", "foam", "köpük", "jel temiz", "micel", "yüz yıkama", "face wash"],
  sunscreen:     ["güneş", "sunscreen", "spf", "uv", "koruyucu", "sun"],
  serum:         ["serum", "ampul", "ampoule"],
  toner:         ["tonik", "toner", "essence", "losyon toner", "exfoliant", "aha", "bha", "peeling"],
  moisturizer:   ["nemlendirici", "moisturizer", "krem", "cream", "losyon", "lotion", "gece kremi", "night cream", "bariyer", "barrier", "onarıcı", "ceramid"],
  eye_care:      ["göz", "eye", "göz altı", "periorbital"],
  mask:          ["maske", "mask", "kil", "clay"],
  face_oil:      ["yağ", "oil", "rosehip", "argan"],
};

/** Her adım tipi için hangi kategori grubunu kullanacağını belirler. */
function getStepCategoryGroup(stepName: string): string | null {
  const n = stepName.toLowerCase();

  // Güneş — en önce çünkü SPF içeren nemlendirici karışmaması için
  if (n.includes("güneş") || n.includes("spf") || n.includes("gunes") || n.includes("mineral spf"))
    return "sunscreen";

  // Temizleyici
  if (
    n.includes("temizle") || n.includes("temizleyici") ||
    n.includes("köpük") || n.includes("jel temiz") || n.includes("kremsi temizle") ||
    n.includes("çift temizle") || n.includes("micel") || n.includes("yüz yıkama") || n.includes("hassas cilt temiz")
  ) return "cleanser";

  // ECZ4 SAVED-ROUTINE-FIX-1 — Göz adımı SERUM'dan ÖNCE eşleşmeli.
  // Aksi halde "Göz Altı Kremi - Kafein + Peptit" / "Göz Kremi + Hyaluronik
  // Asit" gibi adımlar peptit/hyaluronik/niasinamid keyword'leri serum
  // check'inde önce yakalandığı için yanlışlıkla serum kategorisine düşer
  // ve göz adımı altına ortak serum (CeraVe Hyaluronic vb.) sızar.
  if (n.includes("göz") || n.includes("goz") || n.includes("eye") || n.includes("periorbital"))
    return "eye_care";

  // Tonik / Eksfoliant
  if (
    n.includes("tonik") || n.includes("toner") ||
    n.includes("aha") || n.includes("bha") || n.includes("eksfoliasyon") || n.includes("peeling")
  ) return "toner";

  // Serumlar (özel aktifler dahil)
  if (
    n.includes("serum") ||
    n.includes("niacinamide") || n.includes("niasin") ||
    n.includes("vitamin c") || n.includes("c vitamin") ||
    n.includes("retinol") || n.includes("retinoid") || n.includes("a vitamin") ||
    n.includes("hyaluronik") || n.includes("hiyalüronik") ||
    n.includes("peptit") || n.includes("peptide") ||
    n.includes("pantenol") || n.includes("panthenol") ||
    n.includes("soothing") || n.includes("yatıştır")
  ) return "serum";

  // Maske
  if (n.includes("maske") || n.includes("mask"))
    return "mask";

  // Yüz yağı
  if (n.includes("yüz yağ") || n.includes("masaj yağ") || n.includes("face oil") || n.includes("yağı masaj"))
    return "face_oil";

  // Nemlendirici / Krem / Bariyer / Gece
  if (
    n.includes("nemlendirici") || n.includes("krem") || n.includes("gece") ||
    n.includes("zengin") || n.includes("losyon") || n.includes("jel nem") ||
    n.includes("bariyer") || n.includes("onarıcı") || n.includes("ceramid") || n.includes("seramid") ||
    n.includes("yoğun") || n.includes("kalın")
  ) return "moisturizer";

  return null; // Genel fallback
}

/**
 * Bir ürünün verilen adım için geçerli kategoride olup olmadığını doğrular.
 * Hard validation — yanlış kategorideki ürünler reddedilir.
 */
export function isProductValidForStep(product: V2DBProduct, stepName: string): boolean {
  const group = getStepCategoryGroup(stepName);
  if (!group) return true; // Tanımsız grup → her ürüne izin ver (güvenli fallback)

  const anchors = CATEGORY_ANCHORS[group] ?? [];
  const catLower = (product.category ?? "").toLowerCase();

  return anchors.some((anchor) => catLower.includes(anchor));
}

// ─── EH18 Bug#2 · Aktif içerik intent guard ───────────────────────────────────
// EH20: Bu mantık @workspace/intent-guard kütüphanesine taşındı.
// matchesActiveIntent yukarıda re-export edilir; tüm var olan caller'lar
// (fetchAlternativesForStep, fetchChatProductsByPreference) değişmeden çalışır.

// ─── SPF 50 öncelik puanı ─────────────────────────────────────────────────────

function spf50Score(p: V2DBProduct): number {
  const hay = `${p.name ?? ""} ${p.short_benefit ?? ""} ${p.category ?? ""}`.toLowerCase();
  if (hay.includes("spf 50+") || hay.includes("spf50+")) return 3;
  if (hay.includes("spf 50")  || hay.includes("spf50"))  return 2;
  if (hay.includes("50"))                                 return 1;
  return 0;
}

// ─── Client-side relevance score ─────────────────────────────────────────────

function relevanceScore(p: V2DBProduct, keywords: string[]): number {
  const hay = [p.name ?? "", p.short_benefit ?? "", p.category ?? ""].join(" ").toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (hay.includes(kw.toLowerCase())) score++;
  }
  return score;
}

// ─── Relevance keywords (sıralama için — filtre için değil) ───────────────────

function getRelevanceKeywords(stepName: string): string[] {
  const n = stepName.toLowerCase();

  if (n.includes("güneş") || n.includes("spf") || n.includes("gunes"))
    return ["spf", "güneş", "gunes", "sunscreen", "uv", "koruyucu"];
  if (n.includes("çift temizle") || n.includes("yağlı temiz") || n.includes("oil clean"))
    return ["oil clean", "yağ", "micel", "temizleyici"];
  if (n.includes("temizle") || n.includes("köpük") || n.includes("jel temiz"))
    return ["temizleyici", "cleanser", "foaming", "gel clean", "yüz"];
  // ECZ4 SAVED-ROUTINE-FIX-1 — getStepCategoryGroup ile aynı önceliklendirme:
  // göz adımı, peptit/hyaluronik/niasinamid serum keyword'lerinden ÖNCE
  // eşleşmeli ki "Göz Altı Kremi - Kafein + Peptit" göz keyword'leriyle
  // skorlansın, serum keyword'leriyle değil.
  if (n.includes("göz") || n.includes("goz") || n.includes("eye"))
    return ["göz", "eye", "under-eye", "periorbital"];
  if (n.includes("tonik") || n.includes("toner"))
    return ["tonik", "toner", "essence"];
  if (n.includes("aha") || n.includes("eksfoliasyon") || n.includes("peeling"))
    return ["aha", "bha", "peeling", "exfoliant", "asit", "acid"];
  if (n.includes("bha"))
    return ["bha", "salicyl", "exfoliant", "asit"];
  if (n.includes("niasinamid") || n.includes("niacinamide"))
    return ["niacinamide", "niasinamid", "serum", "pore"];
  if (n.includes("c vitamini") || n.includes("vitamin c"))
    return ["vitamin c", "ascorbic", "aydınlatıcı", "serum"];
  if (n.includes("retinol") || n.includes("retinoid"))
    return ["retinol", "retinoid", "retinal"];
  if (n.includes("peptit") || n.includes("peptide"))
    return ["peptit", "peptide", "kollajen", "collagen"];
  if (n.includes("pantenol") || n.includes("panthenol"))
    return ["panthenol", "pantenol", "bariyer"];
  if (n.includes("hyaluronik") || n.includes("hiyalüronik"))
    return ["hyaluronik", "hyaluronic", "hidrasyon"];
  if (n.includes("serum"))
    return ["serum", "essence"];
  if (n.includes("göz") || n.includes("goz"))
    return ["göz", "eye", "under-eye"];
  if (n.includes("maske") || n.includes("mask"))
    return ["maske", "mask", "clay", "kil"];
  if (n.includes("yüz yağ") || n.includes("masaj yağ"))
    return ["yüz yağ", "rosehip", "argan"];
  if (n.includes("onarıcı") || n.includes("bariyer") || n.includes("gece"))
    return ["gece", "onarıcı", "repair", "bariyer", "ceramid"];
  if (n.includes("yoğun nemlen"))
    return ["yoğun", "intense", "rich", "nemlendirici"];
  if (n.includes("zengin") || n.includes("ceramid") || n.includes("seramid"))
    return ["ceramid", "ceramide", "bariyer", "barrier"];

  return ["nemlendirici", "moisturizer", "krem", "cream"];
}

// ─── Segment normalize ────────────────────────────────────────────────────────

function normalizeSegment(raw?: string): "ekonomik" | "profesyonel" | "seckin" | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes("ekon"))                        return "ekonomik";
  if (r.includes("prof"))                        return "profesyonel";
  if (r.includes("seç") || r.includes("sec"))   return "seckin";
  return null;
}

// ─── Segment dağılımı yardımcısı ─────────────────────────────────────────────

function distributeBySegment(
  scored: V2DBProduct[],
  maxEk = 4, maxPro = 4, maxSec = 2
): V2Alternatives {
  const ekonomikAll:    V2DBProduct[] = [];
  const profesyonelAll: V2DBProduct[] = [];
  const seckinAll:      V2DBProduct[] = [];

  for (const p of scored) {
    const seg = normalizeSegment(p.segment);
    if (seg === "ekonomik")         ekonomikAll.push(p);
    else if (seg === "profesyonel") profesyonelAll.push(p);
    else if (seg === "seckin")      seckinAll.push(p);
    else                            ekonomikAll.push(p);
  }

  return {
    ekonomik:    ekonomikAll.slice(0, maxEk),
    profesyonel: profesyonelAll.slice(0, maxPro),
    seckin:      seckinAll.slice(0, maxSec),
  };
}

// ─── Category-anchored OR filter builder ──────────────────────────────────────

/** Yalnızca category kolonunu filtreleyen Supabase OR string'i oluşturur. */
function buildCategoryOnlyFilter(anchors: string[]): string {
  return anchors
    .map((a) => `category.ilike.%${a.replace(/[%_]/g, "")}%`)
    .join(",");
}

/** Hem category hem name hem short_benefit kolonlarını kapsayan OR filtresi. */
function buildBroadFilter(keywords: string[]): string {
  const parts: string[] = [];
  for (const kw of keywords) {
    const safe = kw.replace(/[%_]/g, "");
    if (!safe) continue;
    parts.push(`category.ilike.%${safe}%`);
    parts.push(`name.ilike.%${safe}%`);
    parts.push(`short_benefit.ilike.%${safe}%`);
  }
  return parts.join(",");
}

// ─── Ana sorgu ────────────────────────────────────────────────────────────────

/**
 * Verilen step adına göre SADECE o adımın kategorisindeki ürünleri çeker.
 *
 * Akış:
 *   1. Adımdan kategori grubu al
 *   2. Supabase'e category-only filtreli sorgu gönder
 *   3. Hard validation ile yanlış kategoriyi at
 *   4. Relevance scoring → segment dağılımı
 *   5. Eğer 0 sonuç → geniş arama dene (ama hard validation korur)
 */
export async function fetchAlternativesForStep(
  stepName: string
): Promise<V2Alternatives> {
  const group    = getStepCategoryGroup(stepName);
  const anchors  = group ? (CATEGORY_ANCHORS[group] ?? []) : [];
  const keywords = getRelevanceKeywords(stepName);
  const isSunscreen = group === "sunscreen";

  let data: V2DBProduct[] = [];

  // ── ADIM 1: Kategori-kilitli sorgu ──────────────────────────────────────────
  if (anchors.length > 0) {
    const catFilter = buildCategoryOnlyFilter(anchors);
    const res = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .or(catFilter)
      .limit(80);

    if (res.error) {
      console.warn(`[v2ProductDB] Kategori sorgu hatası (${stepName}):`, res.error.message);
    } else {
      data = (res.data ?? []) as V2DBProduct[];
    }

    console.log(`[v2ProductDB] "${stepName}" → grup:${group} | kategori filtresi: ${data.length} aday`);
  }

  // ── ADIM 2: Sonuç yoksa geniş aramaya düş (hard validation devrede kalır) ──
  if (data.length === 0 && keywords.length > 0) {
    console.log(`[v2ProductDB] "${stepName}" → kategori sorgusu boş, geniş arama deneniyor`);
    const broadFilter = buildBroadFilter(keywords);
    const res = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .or(broadFilter)
      .limit(80);

    if (!res.error && res.data) {
      data = res.data as V2DBProduct[];
    }
  }

  if (data.length === 0) {
    console.log(`[v2ProductDB] "${stepName}" → hiç sonuç yok`);
    return { ekonomik: [], profesyonel: [], seckin: [] };
  }

  // ── ADIM 3: Hard validation — yanlış kategorideki ürünleri at ───────────────
  const validated = anchors.length > 0
    ? data.filter((p) => isProductValidForStep(p, stepName))
    : data;

  if (validated.length < data.length) {
    console.log(`[v2ProductDB] "${stepName}" → hard validation: ${data.length - validated.length} ürün reddedildi`);
  }

  // ── ADIM 4: Relevance scoring & sıralama ────────────────────────────────────
  const scored = validated
    .map((p) => ({ p, score: relevanceScore(p, keywords) }))
    .sort((a, b) => {
      if (isSunscreen) {
        const spfDiff = spf50Score(b.p) - spf50Score(a.p);
        if (spfDiff !== 0) return spfDiff;
      }
      return b.score - a.score;
    })
    .map(({ p }) => p);

  const result = distributeBySegment(scored);
  console.log(
    `[v2ProductDB] "${stepName}" → ekon:${result.ekonomik.length} pro:${result.profesyonel.length} sec:${result.seckin.length}` +
    ` | öneri: "${result.profesyonel[0]?.name ?? result.ekonomik[0]?.name ?? "yok"}"`
  );
  return result;
}

// ─── Toplu adım sorgusu ───────────────────────────────────────────────────────

/**
 * Birden fazla step adı için toplu ürün çeker.
 * Her adım kendi kategorisinden ürün getirir — karışmaz.
 */
export async function fetchTopProductsForSteps(
  stepNames: string[],
  maxPerSegment = 4
): Promise<V2Alternatives> {
  if (!stepNames.length) return { ekonomik: [], profesyonel: [], seckin: [] };

  const uniqueSteps = Array.from(new Set(stepNames)).slice(0, 6);
  console.log(`[v2ProductDB] fetchTopProductsForSteps → ${uniqueSteps.length} adım için paralel sorgu`);

  const results = await Promise.all(
    uniqueSteps.map((name) => fetchAlternativesForStep(name))
  );

  const seen = new Set<string>();
  const merged: V2Alternatives = { ekonomik: [], profesyonel: [], seckin: [] };

  for (const r of results) {
    for (const p of r.ekonomik)    { if (!seen.has(p.id)) { seen.add(p.id); merged.ekonomik.push(p); } }
    for (const p of r.profesyonel) { if (!seen.has(p.id)) { seen.add(p.id); merged.profesyonel.push(p); } }
    for (const p of r.seckin)      { if (!seen.has(p.id)) { seen.add(p.id); merged.seckin.push(p); } }
  }

  console.log(`[v2ProductDB] fetchTopProductsForSteps → toplam ekon:${merged.ekonomik.length} pro:${merged.profesyonel.length} sec:${merged.seckin.length}`);

  return {
    ekonomik:    merged.ekonomik.slice(0, maxPerSegment),
    profesyonel: merged.profesyonel.slice(0, maxPerSegment),
    seckin:      merged.seckin.slice(0, Math.min(maxPerSegment, 2)),
  };
}

// ─── Ürün adıyla arama ────────────────────────────────────────────────────────

// ─── Segment normalizasyon (chat için export) ─────────────────────────────────

export type SegmentGroup = "ekonomik" | "profesyonel" | "seckin";

export function normalizeSegGroup(seg?: string): SegmentGroup | null {
  const s = (seg ?? "").toLowerCase();
  if (s.includes("seç") || s.includes("sec")) return "seckin";
  if (s.includes("prof"))                      return "profesyonel";
  if (s.includes("eko"))                       return "ekonomik";
  return null;
}

function altSegs(preferred: SegmentGroup): [SegmentGroup, SegmentGroup] {
  if (preferred === "ekonomik") return ["profesyonel", "seckin"];
  if (preferred === "seckin")   return ["profesyonel", "ekonomik"];
  return ["ekonomik", "seckin"]; // profesyonel → alt: Eko, üst: Seçkin
}

export interface ChatProductResult {
  primary: V2DBProduct | null;
  alts:    V2DBProduct[];
}

/**
 * DermoAsistan sohbet içi ürün kartları — tercih edilen segmente göre getirir.
 *
 * Döner:
 *  primary → tercih edilen segmentten 1 ürün (yoksa başka segmentten)
 *  alts    → alt segment (1 aşağı) + üst segment (1 yukarı), her birinden 1 ürün
 */
export async function fetchChatProductsByPreference(
  hint: string,
  preferredSeg: string,
): Promise<ChatProductResult> {
  const group   = getStepCategoryGroup(hint);
  const anchors = group ? (CATEGORY_ANCHORS[group] ?? []) : [];
  if (anchors.length === 0) return { primary: null, alts: [] };

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .or(buildCategoryOnlyFilter(anchors))
    .limit(40);

  if (error || !data || data.length === 0) return { primary: null, alts: [] };

  // 1. Kategori filtresi (hard)
  const valid = (data as V2DBProduct[]).filter(p => isProductValidForStep(p, hint));
  if (valid.length === 0) return { primary: null, alts: [] };

  // 2. EH18 Bug#2 + EH20: Aktif içerik intent filtresi (hard) — kategori doğru
  // ama aktif içerik niyetiyle uyumsuz ürünleri eler. Aynı filtre Node API
  // server'ın /danisma/urun-oneri endpoint'inde de uygulanır
  // (@workspace/intent-guard).
  const intentMatched = valid.filter(p => matchesActiveIntent(p, hint));
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[intent-guard:client/chat] hint="${hint}" → before=${valid.length} after=${intentMatched.length}`,
    );
  }
  // Eğer intent filtresinden hiçbir ürün geçmediyse, kullanıcıya yanlış ürün
  // göstermektense BOŞ döneriz (UI zaten "eşleşen ürün bulunamadı" notu basıyor).
  const pool = intentMatched.length > 0 ? intentMatched : [];
  if (pool.length === 0) return { primary: null, alts: [] };

  // 3. Relevance keyword'lerine göre skorla, sonra görseli olanı öne al
  const relevanceKws = getRelevanceKeywords(hint);
  const scored = pool
    .map(p => ({ p, score: relevanceScore(p, relevanceKws), hasImg: (p.thumbnail_url || p.image_url) ? 1 : 0 }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;     // yüksek skor önce
      if (a.hasImg !== b.hasImg) return b.hasImg - a.hasImg; // görselli önce
      return 0;
    });
  const sorted = scored.map(s => s.p);

  // Segmente göre grupla
  const byGroup: Record<SegmentGroup, V2DBProduct[]> = {
    ekonomik:    sorted.filter(p => normalizeSegGroup(p.segment) === "ekonomik"),
    profesyonel: sorted.filter(p => normalizeSegGroup(p.segment) === "profesyonel"),
    seckin:      sorted.filter(p => normalizeSegGroup(p.segment) === "seckin"),
  };

  const normPref = normalizeSegGroup(preferredSeg) ?? "profesyonel";

  // Primary: tercih edilen segmentten, yoksa herhangi bir ürün
  const primary = byGroup[normPref][0] ?? sorted[0] ?? null;

  // Alternatifler: alt + üst segment
  const [seg1, seg2] = altSegs(normPref);
  const alt1 = byGroup[seg1][0] ?? null;
  const alt2 = byGroup[seg2][0] ?? null;
  const alts = [alt1, alt2].filter((p): p is V2DBProduct => p !== null);

  return { primary, alts };
}

/**
 * DermoAsistan sohbet içi ürün kartları için — kategori ipucundan max maxItems ürün çeker.
 * Segment önceliği: seçkin > profesyonel > ekonomik.
 * Görseli olan ürünler önce sıralanır.
 */
export async function fetchChatProducts(hint: string, maxItems = 3): Promise<V2DBProduct[]> {
  const group   = getStepCategoryGroup(hint);
  const anchors = group ? (CATEGORY_ANCHORS[group] ?? []) : [];
  if (anchors.length === 0) return [];

  const orFilter = buildCategoryOnlyFilter(anchors);

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .or(orFilter)
    .limit(40);

  if (error || !data || data.length === 0) return [];

  const valid = (data as V2DBProduct[]).filter(p => isProductValidForStep(p, hint));

  const segOrder = (s?: string): number => {
    const r = (s ?? "").toLowerCase();
    if (r.includes("seç") || r.includes("sec")) return 0;
    if (r.includes("prof"))                      return 1;
    return 2;
  };

  const sorted = valid.sort((a, b) => {
    const sSeg = segOrder(a.segment) - segOrder(b.segment);
    if (sSeg !== 0) return sSeg;
    const imgA = (a.thumbnail_url || a.image_url) ? 0 : 1;
    const imgB = (b.thumbnail_url || b.image_url) ? 0 : 1;
    return imgA - imgB;
  });

  return sorted.slice(0, maxItems);
}

/**
 * Ürün adıyla DB'den ürün ID'si bul (product detail navigasyonu için).
 */
export async function findProductByName(name: string): Promise<V2DBProduct | null> {
  if (!name?.trim()) return null;

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .ilike("name", `%${name.trim()}%`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as V2DBProduct;
}
