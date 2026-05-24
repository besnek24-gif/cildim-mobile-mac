/**
 * Karşılaştırma çifti uyumluluğu için paylaşılan yardımcı fonksiyonlar.
 *
 * Eşleşme öncelik sırası:
 *  1. Aynı subcategory
 *  2. Aynı category (subcategory yoksa)
 *  3. Concern çakışması yoksa geç (her iki üründe concern varsa ve örtüşmüyorsa iptal)
 */

type PairKeyable = {
  id?: string | number | null;
  name?: string | null;
  isim?: string | null;
  brand?: string | null;
  marka?: string | null;
  subcategory?: string | null;
  category?: string | null;
  kategori?: string | null;
  concerns?: string[] | null;
  concerns_supported?: string[] | null;
  /** Eski / alternatif alan adları */
  skin_concern?: string | string[] | null;
  purpose?: string | string[] | null;
  usage_area?: string | string[] | null;
};

// ─── getBaseName ────────────────────────────────────────────────────────────

/**
 * Ürün isminden hacim / boy / adet bilgilerini çıkararak temel ürün adını döner.
 * "Effaclar Duo+ 40 ml" → "effaclar duo+"
 * "Hyalu B5 Serum 30 gr" → "hyalu b5 serum"
 * "Maske 10 adet" → "maske"
 *
 * Aynı ürünün varyantlarını (40ml vs 200ml) eşleştirebilmek için kullanılır.
 */
export function getBaseName(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.toLowerCase().trim();

  // 1) Parantezli varyant blokları: "(50 ml)", "(2 x 30 g)"
  s = s.replace(/\s*\([^)]*\b\d+(?:[.,]\d+)?\s*(?:ml|cc|g|gr|gram|kg|adet|tablet|kaps[uü]l)[^)]*\)/gi, " ");

  // 2) Açık hacim/ağırlık/adet: "40 ml", "200g", "30 gr", "10 adet", "1 kg", "20 tablet"
  s = s.replace(/\s*\b\d+(?:[.,]\d+)?\s*(?:ml|cc|g|gr|gram|kg|adet|tablet|kaps[uü]l|pack)\b\.?/gi, " ");

  // 3) Çarpan kalıpları: "x 2", "× 3", "2x"
  s = s.replace(/\s*\b[xX×]\s*\d+\b/g, " ");
  s = s.replace(/\b\d+\s*[xX×]\s+/g, " ");

  // 4) Sondaki "30'lu", "50'li" gibi Türkçe paket sayı ekleri
  s = s.replace(/\s*\b\d+\s*['’]?\s*(?:lu|lü|li|lı)\b/gi, " ");

  // 5) Whitespace + sondaki noktalama
  s = s.replace(/\s+/g, " ").replace(/[.,;:\-]+$/, "").trim();
  return s;
}

// ─── Kategori sanitizasyonu ─────────────────────────────────────────────────

/**
 * EH19 · Verilen string boyut/hacim/adet ifadesi mi?
 * "200 ml", "500ml", "30 gr", "10 adet", "2x200 ml", "50'li" → true
 * Veri tabanında yanlışlıkla `category` kolonuna yazılmış varyant
 * etiketlerini grup anahtarı olarak kullanmamak için.
 */
function isSizeToken(s: string): boolean {
  if (!s) return false;
  const t = s.trim().toLowerCase();
  if (!t) return false;
  // Tamamen sayı + birim: "200 ml", "30g", "1 kg"
  if (/^\d+(?:[.,]\d+)?\s*(?:ml|cc|g|gr|gram|kg|adet|tablet|kaps[uü]l|pack|pcs)\b\.?$/i.test(t)) return true;
  // Çarpan kalıbı: "2 x 200 ml"
  if (/^\d+\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:ml|cc|g|gr|kg|adet|tablet|kaps[uü]l|pack)\b/i.test(t)) return true;
  // Türkçe paket eki: "50'li", "10'lu"
  if (/^\d+\s*['’]?\s*(?:lu|lü|li|lı)$/i.test(t)) return true;
  return false;
}

/**
 * EH19 · Ürün adından anlamlı temel kategoriye (whitelist) düşürür.
 * Eşleşme yoksa boş string döner.
 */
const NAME_CATEGORY_RULES: { match: RegExp; label: string }[] = [
  { match: /\b(şampuan|shampoo)\b/i, label: "şampuan" },
  { match: /\b(saç\s*kremi|conditioner|kondisyoner|durulanmaz)\b/i, label: "saç kremi" },
  { match: /\b(saç\s*serum|hair\s*serum)\b/i, label: "saç serumu" },
  { match: /\b(saç\s*maskesi|hair\s*mask)\b/i, label: "saç maskesi" },
  { match: /\b(duş\s*jeli|vücut\s*şampuanı|body\s*wash|shower\s*gel)\b/i, label: "duş jeli" },
  { match: /\b(yüz\s*temizleme|cleanser|temizleme\s*jeli|temizleme\s*sütü|köpük|foam)\b/i, label: "yüz temizleyici" },
  { match: /\b(serum)\b/i, label: "serum" },
  { match: /\b(tonik|toner|misel(?:ar)?\s*su|misel(?:lar)?\s*su)\b/i, label: "tonik" },
  { match: /\b(göz\s*krem|eye\s*cream)\b/i, label: "göz kremi" },
  { match: /\b(yüz\s*krem|day\s*cream|night\s*cream|gece\s*krem|gündüz\s*krem|moisturiz|nemlendirici|krem)\b/i, label: "nemlendirici" },
  // SPF: "SPF", "SPF50", "SPF50+", "SPF 50" — \bspf\b başarısız olur çünkü
  // "SPF50" içinde harf-rakam arası word boundary yoktur. spf\d* takip eden
  // \b ise "SPF50" sonrasında (rakam→non-word) boundary üretir.
  { match: /\b(güneş\s*kremi|sunscreen|spf\d*)\b/i, label: "güneş koruyucu" },
  { match: /\b(maske|mask)\b/i, label: "maske" },
  { match: /\b(peeling|eksfoli|exfoli|scrub)\b/i, label: "peeling" },
  { match: /\b(dudak|lip\s*balm|lipstick)\b/i, label: "dudak bakım" },
];

function inferCategoryFromName(name: string | null | undefined): string {
  if (!name) return "";
  for (const r of NAME_CATEGORY_RULES) {
    if (r.match.test(name)) return r.label;
  }
  return "";
}

/**
 * EH19 · Şampuan ve saç kremi için purpose alt-grubunu üretir.
 * Bebek şampuanı kepek şampuanıyla, dökülme karşıtı şampuan
 * Pantene bakımıyla aynı havuza düşmesin diye.
 */
function detectHaircarePurpose(p: PairKeyable, name: string): string {
  const hay = (
    name + " " +
    (Array.isArray(p.concerns) ? p.concerns.join(" ") : "") + " " +
    (Array.isArray(p.skin_concern) ? p.skin_concern.join(" ") : (p.skin_concern ?? "")) + " " +
    (Array.isArray(p.purpose) ? p.purpose.join(" ") : (p.purpose ?? "")) + " " +
    ((p.subcategory ?? "") as string)
  ).toLowerCase();

  if (/\b(bebek|baby|kids|çocuk)\b/.test(hay)) return "bebek";
  if (/\b(kepek|anti[-\s]?dandruff|seboreik|seborrheic|ds|sd)\b/.test(hay)) return "kepek karşıtı";
  if (/\b(dökülme|dökülmesi|hair\s*loss|anti[-\s]?hair[-\s]?loss|gür)\b/.test(hay)) return "dökülme karşıtı";
  if (/\b(onarıcı|repair|hasarlı|damaged|keratin|protein\s*tedavi)\b/.test(hay)) return "onarıcı";
  if (/\b(hassas|sensitive|tahriş|irritation)\b/.test(hay)) return "hassas";
  if (/\b(yağlı\s*saç|oily\s*scalp|sebum)\b/.test(hay)) return "yağlı saç";
  if (/\b(kuru\s*saç|dry\s*hair|nemlendiri)\b/.test(hay)) return "kuru saç";
  if (/\b(renkli|boyalı|color\s*safe)\b/.test(hay)) return "boyalı saç";
  return "genel";
}

// ─── canonicalizeCategoryGroup ─────────────────────────────────────────────

/**
 * Karşılaştırma grup anahtarı için kategori/subcategory string'lerini
 * KANONİK gruplara indirir.
 *
 * BUG FIX: Supabase'te aynı havuz için birden çok etiket bulunuyor:
 *   "Güneş Bakımı", "Güneş Koruyucu", "Güneş Kremi", "Sunscreen", "SPF"
 *   "Yüz Temizleme Jeli", "Cleanser", "Yüz Temizleyici", "Köpük"
 *   "Nemlendirici", "Day Cream", "Yüz Kremi", "Moisturizer"
 *   ...
 * Eski pairKey() bu ham etiketleri lowercase + trim ile karşılaştırdığı
 * için "Güneş Bakımı" ürünü "Güneş Koruyucu" ürünüyle eşleşemiyordu.
 *
 * Bu fonksiyon, BİLİNEN sinonimleri tek bir kanonik etikete (örn.
 * "güneş koruyucu") düşürür. Eşleşme yoksa girdiyi olduğu gibi döner —
 * yani GERİYE UYUMLUDUR ve eski kategoriler için davranış değişmez.
 *
 * Yalnızca isimden-çıkarım kuralları (NAME_CATEGORY_RULES) ile aynı
 * kanonik etiketleri kullanır → isimden çıkarım yapılmış ürünler ile
 * gerçek kategori string'i olan ürünler aynı havuza düşer.
 */
const CATEGORY_CANONICAL_RULES: { match: RegExp; label: string }[] = [
  // Güneş koruması — tüm etiket varyantları tek havuzda.
  // SPF varyantı için spf\d* kullanılır; "SPF50+" / "SPF 50" yakalanır
  // (düz \bspf\b harf-rakam arası boundary üretmediği için "SPF50"de iflas eder).
  { match: /\b(güneş\s*(bakım|krem|koruyucu|koruma)|sunscreen|sun\s*care|spf\d*|sun[-\s]?block)\b/i, label: "güneş koruyucu" },

  // Şampuan
  { match: /\b(şampuan|shampoo)\b/i, label: "şampuan" },

  // Saç kremi / conditioner
  { match: /\b(saç\s*kremi|conditioner|kondisyoner|durulanmaz\s*krem)\b/i, label: "saç kremi" },

  // Saç maskesi / serumu — ayrı tutuldu
  { match: /\b(saç\s*serum|hair\s*serum)\b/i, label: "saç serumu" },
  { match: /\b(saç\s*maske|hair\s*mask)\b/i, label: "saç maskesi" },

  // Yüz temizleyici (jel/köpük/süt/cleanser)
  { match: /\b(yüz\s*temizle|temizleme\s*jel|temizleme\s*süt|köpük|foam\s*cleanser|face\s*wash|cleanser)\b/i, label: "yüz temizleyici" },

  // Tonik / micellar
  { match: /\b(tonik|toner|misel(?:l?ar)?\s*su|micellar)\b/i, label: "tonik" },

  // Serum (yüz)
  { match: /\b(yüz\s*serum|face\s*serum|serum)\b/i, label: "serum" },

  // Göz kremi
  { match: /\b(göz\s*krem|eye\s*cream|eye\s*serum|göz\s*serum)\b/i, label: "göz kremi" },

  // Nemlendirici (krem) — son sırada, "göz kremi" gibi spesifik etiketler
  // önce eşleşsin diye.
  { match: /\b(nemlendirici|moisturi[sz]er|gündüz\s*krem|gece\s*krem|day\s*cream|night\s*cream|yüz\s*krem|face\s*cream|krem|cream)\b/i, label: "nemlendirici" },

  // Maske (yüz)
  { match: /\b(yüz\s*maske|face\s*mask|maske|mask)\b/i, label: "maske" },

  // Peeling / eksfoliyasyon
  { match: /\b(peeling|eksfoli|exfoli|scrub)\b/i, label: "peeling" },

  // Dudak bakımı
  { match: /\b(dudak\s*bak|lip\s*balm|lipstick|dudak\s*krem)\b/i, label: "dudak bakım" },

  // Akne / sivilce — ürün tipi değil concern, ama bazı DB satırlarında
  // category olarak yer alıyor. Tek havuzda topla.
  { match: /\b(akne|acne|sivilce)\b/i, label: "akne tedavisi" },

  // Duş jeli / vücut şampuanı
  { match: /\b(duş\s*jel|body\s*wash|shower\s*gel|vücut\s*şampuan)\b/i, label: "duş jeli" },
];

export function canonicalizeCategoryGroup(raw: string): string {
  if (!raw) return "";
  for (const r of CATEGORY_CANONICAL_RULES) {
    if (r.match.test(raw)) return r.label;
  }
  // Eşleşme yok → girdiyi olduğu gibi döner (geriye uyumluluk).
  return raw.toLowerCase().trim();
}

// CATEGORY_CANONICAL_RULES'tan üretilmiş bilinen kanonik label seti.
// Bir canonicalize() çağrısının kanonik gruba mı düştüğünü, yoksa
// ham fallback mi olduğunu ayırt etmek için kullanılır.
const KNOWN_CANONICAL_LABELS: Set<string> = new Set(
  CATEGORY_CANONICAL_RULES.map((r) => r.label),
);

/**
 * Verilen string KANONİK bir gruba düşüyor mu? (yani fallback değil mi)
 * Örn:
 *   "güneş koruyucu"   → true
 *   "Yüz Güneş Kremi"  → true ("güneş koruyucu" grubuna düşer)
 *   "Yüz"              → false (kanonik değil, ham fallback)
 *   "Vücut"            → false
 */
function canonicalizeIfKnown(raw: string): string | null {
  const c = canonicalizeCategoryGroup(raw);
  return c && KNOWN_CANONICAL_LABELS.has(c) ? c : null;
}

// ─── pairKey ───────────────────────────────────────────────────────────────

/**
 * Ürünün karşılaştırma grup anahtarını döner.
 *
 * EH19 · Geliştirilmiş davranış:
 *  1. subcategory → boyut tokenı değilse kullan
 *  2. category    → boyut tokenı değilse kullan
 *  3. her ikisi de geçersizse → ürün adından beyaz-listeden çıkar
 *  4. çıkarılamazsa → "" (gruptan dışla, "Diğer" havuzuna düşmesin)
 *  5. canonicalizeCategoryGroup(): bilinen sinonimleri tek havuza indir
 *     (örn. "Güneş Bakımı" + "Güneş Koruyucu" + "SPF" → "güneş koruyucu")
 *  6. şampuan/saç kremi ise purpose suffix ekle ("şampuan / kepek karşıtı")
 */
export function pairKey(p: PairKeyable): string {
  const subRaw = (p.subcategory ?? "").trim();
  const catRaw = (p.category ?? p.kategori ?? "").trim();
  const nameRaw = (p.name ?? p.isim ?? "").trim();
  const sub = subRaw && !isSizeToken(subRaw) ? subRaw.toLowerCase() : "";
  const cat = catRaw && !isSizeToken(catRaw) ? catRaw.toLowerCase() : "";

  // ── BUG FIX (Anthelios UVMune 400 case) ──────────────────────────────
  // Eski davranış: `base = sub || cat` → subcategory tek bir gövde-parçası
  // ("Yüz", "Vücut") olduğunda canonicalize regex'lerinden hiçbirine
  // girmiyor, ham "yüz" / "vücut" pairKey'i üretip diğer güneş ürünleriyle
  // (pairKey="güneş koruyucu") eşleşemiyordu.
  //
  // Yeni davranış: KASKAD canonicalize. Aynı sırayla kaynakları dener
  // (sub → cat → birleşik sub+cat → name) ve İLK KANONİK eşleşmeyi alır.
  // Hiçbiri kanonik değilse eski fallback'e (sub||cat||name-infer) düşer
  // → geriye uyumluluk korunur, davranış sadece eski boş havuz vakaları
  // için iyileşir.
  let base =
    canonicalizeIfKnown(sub) ??
    canonicalizeIfKnown(cat) ??
    canonicalizeIfKnown(`${sub} ${cat}`.trim()) ??
    canonicalizeIfKnown(nameRaw) ??
    "";

  if (!base) {
    // Hiçbir kanonik eşleşme yok → eski yol: ham sub/cat veya name-infer.
    base = sub || cat;
    if (!base) base = inferCategoryFromName(nameRaw);
  }

  if (!base) return ""; // Hâlâ yoksa: gruptan dışla

  // Geri-uyum: kanonik eşleşmediği halde ham fallback aldıysak yine
  // canonicalize'a geçirelim (no-op ama güvenli).
  base = canonicalizeCategoryGroup(base);

  // Saç bakım alt segmentasyonu
  const isHaircare =
    /\b(şampuan|shampoo|saç\s*krem|conditioner|kondisyoner|saç\s*serum|saç\s*maske)\b/i.test(base) ||
    /\b(şampuan|shampoo|saç\s*krem|conditioner|kondisyoner)\b/i.test(p.name ?? p.isim ?? "");

  if (isHaircare) {
    const head =
      /\bşampuan|shampoo\b/i.test(base) || /\bşampuan|shampoo\b/i.test(p.name ?? p.isim ?? "")
        ? "şampuan"
        : base;
    const purpose = detectHaircarePurpose(p, p.name ?? p.isim ?? "");
    return `${head} / ${purpose}`;
  }

  return base;
}

// ─── concern extraction ────────────────────────────────────────────────────

/**
 * Ürünün kullanım amacı/endişe listesini normalize edilmiş string dizisi olarak döner.
 * Birden fazla alan adını destekler; eksik alanları sessizce atlar.
 */
function getConcerns(p: PairKeyable): string[] {
  const raw: Array<string | string[] | null | undefined> = [
    p.concerns,
    p.concerns_supported,
    p.skin_concern,
    p.purpose,
    p.usage_area,
  ];

  const out = new Set<string>();
  for (const field of raw) {
    if (!field) continue;
    const arr = Array.isArray(field) ? field : [field];
    for (const item of arr) {
      const s = item?.trim().toLowerCase();
      if (s) out.add(s);
    }
  }
  return [...out];
}

/**
 * İki ürünün concern listeleri anlamsız şekilde çakışıyor mu?
 *
 * Kural:
 *  - Her ikisinde de en az 1 concern varsa ve hiç ortak concern yoksa → true (çakışma)
 *  - Birinde veya her ikisinde concern yoksa → false (bilgi yetersiz, çakışma varsayma)
 */
function hasConcernClash(pA: PairKeyable, pB: PairKeyable): boolean {
  const cA = getConcerns(pA);
  const cB = getConcerns(pB);
  if (cA.length === 0 || cB.length === 0) return false;
  return !cA.some((c) => cB.includes(c));
}

// ─── arePairsCompatible ────────────────────────────────────────────────────

/**
 * İki ürünün otomatik eşleşme için uyumlu olup olmadığını döner.
 *
 * true dönebilmesi için:
 *  1. Her iki ürünün pairKey'i dolu VE eşit olmalı (subcategory || category bazlı)
 *  2. Her iki üründe concern verisi varsa, en az 1 ortak concern olmalı
 */
export function arePairsCompatible(pA: PairKeyable, pB: PairKeyable): boolean {
  // Adım 0: Aynı ürün olmamalı (ID veya isim bazlı)
  const idA = String(pA.id ?? "").trim();
  const idB = String(pB.id ?? "").trim();
  if (idA && idB && idA === idB) return false;

  const nameA = (pA.name ?? pA.isim ?? "").trim().toLowerCase();
  const nameB = (pB.name ?? pB.isim ?? "").trim().toLowerCase();
  if (nameA && nameB && nameA === nameB) return false;

  // Adım 0.5: Marka karşılaştırması — aynı markadan SADECE hacim/boy
  // varyantlarını reddet, farklı ürünleri karşılaştırmaya izin ver.
  const brandA = (pA.brand ?? pA.marka ?? "").trim().toLowerCase();
  const brandB = (pB.brand ?? pB.marka ?? "").trim().toLowerCase();

  // Aynı marka kuralı:
  //  • Aynı ürünün hacim/boy varyantı (örn. 40 ml vs 200 ml) → REDDET
  //    (`getBaseName`, "Effaclar Duo+ 40 ml" → "effaclar duo+" gibi
  //     hacim/ağırlık/adet/tablet/kapsül/pack/parantezli varyant
  //     bloklarını ve Türkçe paket eklerini de temizler — spec'in
  //     basit `\d+\s?(ml|g|gr|oz|cl)` regex'inden çok daha güçlü)
  //  • Aksi halde (farklı ürünler aynı markadan) → İZİN VER, kategori
  //    ve concern-clash adımları sonraki kontrollerde devam eder.
  if (brandA && brandB && brandA === brandB) {
    const baseA = getBaseName(pA.name ?? pA.isim);
    const baseB = getBaseName(pB.name ?? pB.isim);
    if (baseA && baseB && baseA === baseB) return false;

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        "[compare] same brand allowed:",
        pA.name ?? pA.isim,
        "vs",
        pB.name ?? pB.isim,
      );
    }
    // ↓ Eskiden burada `return false;` vardı; aynı markadan farklı
    //   ürünleri tamamen elemiyordu. Artık akış sonraki kategori +
    //   concern-clash kontrollerine devam eder.
  }

  const kA = pairKey(pA);
  const kB = pairKey(pB);

  // Adım 1: Temel kategori/subcategory eşleşmesi zorunlu
  if (!(kA && kB && kA === kB)) return false;

  // Adım 2: Concern verisi varsa çakışma kontrolü
  if (hasConcernClash(pA, pB)) return false;

  return true;
}

// ─── pairingScore ──────────────────────────────────────────────────────────

type ScoredPairKeyable = PairKeyable & {
  brand?: string | null;
  marka?: string | null;
  price?: number | null;
  average_price?: number | null;
  segment?: string | null;
};

/**
 * İki uyumlu ürün çiftinin kalite skorunu döner.
 * Yüksek skor → daha anlamlı karşılaştırma.
 *
 * Kriterler:
 *  +10  Aynı subcategory (en güçlü sinyal)
 *  +4   Her ortak concern (max +16)
 *  +3   Farklı marka (markalararası kıyaslama daha değerli)
 *  +2   Her iki üründe fiyat verisi var (fiyat karşılaştırması anlamlı)
 *  +1   Segment farkı var (ekonomik vs premium)
 */
export function pairingScore(pA: ScoredPairKeyable, pB: ScoredPairKeyable): number {
  let score = 0;

  // Subcategory eşleşmesi (+10)
  const subA = (pA.subcategory ?? "").trim().toLowerCase();
  const subB = (pB.subcategory ?? "").trim().toLowerCase();
  if (subA && subB && subA === subB) score += 10;

  // Ortak concern'ler (+4 her biri)
  const cA = getConcerns(pA);
  const cB = getConcerns(pB);
  const commonConcerns = cA.filter((c) => cB.includes(c));
  score += Math.min(commonConcerns.length * 4, 16);

  // Farklı marka (+3)
  const brandA = (pA.brand ?? pA.marka ?? "").trim().toLowerCase();
  const brandB = (pB.brand ?? pB.marka ?? "").trim().toLowerCase();
  if (brandA && brandB && brandA !== brandB) score += 3;

  // Her iki üründe fiyat verisi (+2)
  const priceA = pA.price ?? pA.average_price;
  const priceB = pB.price ?? pB.average_price;
  if (priceA != null && priceB != null) score += 2;

  // Farklı segment (+1)
  const segA = (pA.segment ?? "").trim().toLowerCase();
  const segB = (pB.segment ?? "").trim().toLowerCase();
  if (segA && segB && segA !== segB) score += 1;

  return score;
}
