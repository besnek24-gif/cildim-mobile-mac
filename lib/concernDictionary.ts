/**
 * CiltBakımım — Endişe Sözlüğü (Concern Dictionary)
 * 30+ dermatoloji / eczane endişesi — her biri ürün kategorisi, içerik sinyalleri ve alias'larla.
 * searchEngine.ts tarafından ürün filtreleme için kullanılır.
 */

import { normalizeTR } from "./concernSearchEngine";

export interface ConcernEntry {
  id: string;
  label_tr: string;
  /** Ana akış ID'si (concernSearchEngine FlowId ile eşleşir veya genişletilmiş) */
  flowId: string;
  icon: string;
  color: string;
  /** Arama terimleri / alias'lar */
  aliases: string[];
  /** Ürün kategorisi kısmi eşleşme listesi (toLowerCase içerir) */
  categories: string[];
  /** Alt kategori kısmi eşleşme listesi */
  subcategories?: string[];
  /** product.concerns veya product.tags içinde aranacak anahtar kelimeler */
  concernKeywords?: string[];
  /** product.ingredients içinde boost için aranacak maddeler */
  ingredientSignals?: string[];
  /** Endişeyle ilgisiz kategoriler (kesinlikle hariç tut) */
  excludeCategories?: string[];
}

// ─── Endişe Sözlüğü ───────────────────────────────────────────────────────────

export const CONCERN_DICTIONARY: ConcernEntry[] = [

  // ── 1. AKNE ──────────────────────────────────────────────────────────────────
  {
    id: "akne",
    label_tr: "Akne & Sivilce",
    flowId: "akne",
    icon: "droplet",
    color: "#15803D",
    aliases: [
      "akne", "sivilce", "sivilceli", "pimple", "acne", "siyah nokta", "blackhead",
      "komedon", "yağlı cilt", "yağlanma", "gözenek", "pütür", "iltihaplı",
      "fungal akne", "hormonal akne", "kistik akne",
    ],
    categories: ["temizleyici", "tonik", "serum", "yüz bakım", "cilt bakım", "nemlendirici", "peeling"],
    subcategories: ["akne", "sivilce", "gözenek"],
    concernKeywords: ["akne", "sivilce", "yağlı cilt", "gözenek", "akne sklerleri"],
    ingredientSignals: [
      "salicylic", "bha", "niacinamide", "benzoyl", "zinc", "tea tree",
      "azelaic", "retinol", "sulfur", "adapalene",
    ],
    excludeCategories: ["şampuan", "saç"],
  },

  // ── 2. HASSASİYET ────────────────────────────────────────────────────────────
  {
    id: "hassasiyet",
    label_tr: "Hassas Cilt",
    flowId: "hassasiyet",
    icon: "heart",
    color: "#BE123C",
    aliases: [
      "hassasiyet", "hassas", "hassas cilt", "kızarıklık", "kızarma",
      "tahriş", "kaşınma", "yanma", "batma", "reaksiyon", "cilt alerjisi",
    ],
    categories: ["nemlendirici", "krem", "serum", "yüz bakım", "cilt bakım", "temizleyici"],
    concernKeywords: ["hassas cilt", "kızarıklık", "tahriş"],
    ingredientSignals: [
      "ceramide", "aloe", "panthenol", "centella", "allantoin",
      "bisabolol", "madecassoside", "cica",
    ],
    excludeCategories: ["peeling güçlü", "asit"],
  },

  // ── 3. LEKE ──────────────────────────────────────────────────────────────────
  {
    id: "leke",
    label_tr: "Leke & Ton Eşitsizliği",
    flowId: "leke",
    icon: "zap",
    color: "#7C3AED",
    aliases: [
      "leke", "lekeli", "melazma", "hiperpigmentasyon", "pigmentasyon",
      "ton eşitsizliği", "koyu leke", "aydınlatma", "cilt tonu",
      "güneş lekesi", "sivilce izi",
    ],
    categories: ["serum", "krem", "yüz bakım", "peeling", "aydınlatıcı"],
    concernKeywords: ["leke", "pigmentasyon", "aydınlatma", "hiperpigmentasyon"],
    ingredientSignals: [
      "vitamin c", "ascorbic", "alpha arbutin", "kojic", "tranexamic",
      "niacinamide", "retinol", "licorice", "azelaic",
    ],
    excludeCategories: ["şampuan", "saç"],
  },

  // ── 4. KURULUK ───────────────────────────────────────────────────────────────
  {
    id: "kuruluk",
    label_tr: "Kuruluk & Nemlendirme",
    flowId: "kuruluk",
    icon: "cloud",
    color: "#1D4ED8",
    aliases: [
      "kuruluk", "kuru", "kuru cilt", "nemsizlik", "nem eksikliği",
      "gergin cilt", "pul pul", "pullanma", "çatlak", "soyulma",
      "bariyer", "bariyer bozulması",
    ],
    categories: ["nemlendirici", "krem", "serum", "cilt bakım", "yüz bakım", "vücut"],
    concernKeywords: ["kuruluk", "kuru cilt", "nem", "nemlendirme"],
    ingredientSignals: [
      "hyaluronic", "ha", "ceramide", "glycerin", "urea",
      "shea", "squalane", "sodium pca", "panthenol",
    ],
  },

  // ── 5. GÜNEŞ KORUMA ──────────────────────────────────────────────────────────
  {
    id: "gunes",
    label_tr: "Güneş Koruma",
    flowId: "gunes",
    icon: "sun",
    color: "#B45309",
    aliases: [
      "güneş", "güneş koruma", "spf", "sunscreen", "uv", "güneş kremi",
      "güneş yanığı", "bronzlaşma", "yazlık",
    ],
    categories: ["güneş", "spf", "güneş koruma", "güneş kremi"],
    concernKeywords: ["güneş koruması", "spf", "uv"],
    ingredientSignals: [
      "spf", "titanium dioxide", "zinc oxide", "tinosorb", "avobenzone",
      "octocrylene", "mexoryl",
    ],
    excludeCategories: ["şampuan", "saç"],
  },

  // ── 6. SAÇ DÖKÜLMESİ ─────────────────────────────────────────────────────────
  {
    id: "sac_dokulmesi",
    label_tr: "Saç Dökülmesi",
    flowId: "sac",
    icon: "wind",
    color: "#C2410C",
    aliases: [
      "saç dökülmesi", "saç dökülüyor", "saçım dökülüyor", "dökülme",
      "alopesi", "alopecia", "saç incelmesi", "saç seyrelmesi", "saçım azalıyor",
    ],
    categories: ["şampuan", "saç serumu", "saç bakım", "saç", "serum", "takviye"],
    subcategories: ["saç dökülmesi", "saç güçlendirme"],
    concernKeywords: ["saç dökülmesi", "saç güçlendirme"],
    ingredientSignals: [
      "biotin", "caffeine", "aminexil", "redensyl", "capixyl",
      "saw palmetto", "niacinamide", "zinc",
    ],
    excludeCategories: ["güneş", "nemlendirici yüz"],
  },

  // ── 7. KEPEK ─────────────────────────────────────────────────────────────────
  {
    id: "kepek",
    label_tr: "Kepek & Saç Derisi",
    flowId: "sac",
    icon: "cloud-snow",
    color: "#0891B2",
    aliases: [
      "kepek", "kepekli", "kepek sorunu", "seboreik dermatit saç",
      "saç derisi kaşıntısı", "saç derisi yağlanması",
    ],
    categories: ["şampuan", "saç bakım", "saç"],
    subcategories: ["kepek", "saç derisi"],
    concernKeywords: ["kepek", "seboreik dermatit"],
    ingredientSignals: [
      "zinc pyrithione", "selenium sulfide", "piroctone", "ketoconazole",
      "coal tar", "salicylic", "ciclopirox",
    ],
  },

  // ── 8. ROSACEA ───────────────────────────────────────────────────────────────
  {
    id: "rosacea",
    label_tr: "Rosacea & Kızarıklık",
    flowId: "hassasiyet",
    icon: "alert-circle",
    color: "#DC2626",
    aliases: [
      "rosacea", "rozasea", "rozasya", "kouperoz", "kuperos",
      "kızarıklık", "yüz kızarması", "kılcal damar",
    ],
    categories: ["nemlendirici", "serum", "krem", "güneş", "yüz bakım"],
    concernKeywords: ["rosacea", "kızarıklık", "hassas cilt"],
    ingredientSignals: [
      "azelaic", "niacinamide", "centella", "aloe", "green tea",
      "oat", "licorice", "bismuth",
    ],
    excludeCategories: ["peeling", "asit", "retinol"],
  },

  // ── 9. EGZAMA ────────────────────────────────────────────────────────────────
  {
    id: "egzama",
    label_tr: "Egzama & Atopik Dermatit",
    flowId: "hassasiyet",
    icon: "shield",
    color: "#7C3AED",
    aliases: [
      "egzama", "egzema", "eczema", "atopik", "atopi", "atopik dermatit",
      "kaşıntı", "kaşınan cilt",
    ],
    categories: ["nemlendirici", "krem", "vücut", "cilt bakım", "serum"],
    concernKeywords: ["egzama", "atopik", "kuru cilt"],
    ingredientSignals: [
      "ceramide", "shea", "colloidal oat", "glycerin", "urea",
      "panthenol", "allantoin",
    ],
  },

  // ── 10. YAĞLANMA & GÖZENEK ───────────────────────────────────────────────────
  {
    id: "yaglanma",
    label_tr: "Yağlanma & Gözenek",
    flowId: "akne",
    icon: "thermometer",
    color: "#CA8A04",
    aliases: [
      "yağlanma", "yağlı cilt", "aşırı yağlanma", "sebum", "gözenek",
      "büyük gözenek", "tıkalı gözenek", "mat cilt",
    ],
    categories: ["temizleyici", "tonik", "serum", "nemlendirici", "yüz bakım"],
    concernKeywords: ["yağlı cilt", "gözenek", "sebum kontrolü"],
    ingredientSignals: [
      "niacinamide", "salicylic", "bha", "zinc", "kaolin",
      "clay", "retinol", "azelaic",
    ],
  },

  // ── 11. YAŞLANMA KARŞITI ─────────────────────────────────────────────────────
  {
    id: "anti_aging",
    label_tr: "Yaşlanma Karşıtı",
    flowId: "leke",
    icon: "clock",
    color: "#9333EA",
    aliases: [
      "yaşlanma", "kırışıklık", "ince çizgi", "anti aging", "anti-aging",
      "fotoyaşlanma", "cilt sıkılaştırma", "lifting",
    ],
    categories: ["serum", "krem", "yüz bakım", "göz kremi", "retinol"],
    concernKeywords: ["yaşlanma", "kırışıklık", "anti-aging", "sıkılaştırma"],
    ingredientSignals: [
      "retinol", "retinal", "peptide", "vitamin c", "coq10",
      "resveratrol", "hyaluronic", "niacinamide", "bakuchiol",
    ],
  },

  // ── 12. GÖZ ÇEVRESİ ──────────────────────────────────────────────────────────
  {
    id: "goz_cevresi",
    label_tr: "Göz Çevresi",
    flowId: "leke",
    icon: "eye",
    color: "#0369A1",
    aliases: [
      "göz altı morluğu", "göz altı kararması", "koyu halka", "göz çevresi",
      "göz altı torbası", "şişkinlik", "göz altı dolgunluğu",
    ],
    categories: ["göz kremi", "göz altı", "serum", "yüz bakım"],
    subcategories: ["göz çevresi", "göz altı"],
    concernKeywords: ["göz çevresi", "göz altı"],
    ingredientSignals: [
      "caffeine", "vitamin k", "retinol", "peptide", "vitamin c",
      "niacinamide", "hyaluronic",
    ],
  },

  // ── 13. HAMİLELİKTE CİLT ─────────────────────────────────────────────────────
  {
    id: "hamilelik",
    label_tr: "Hamilelikte Cilt Bakımı",
    flowId: "leke",
    icon: "heart",
    color: "#EC4899",
    aliases: [
      "hamilelik", "hamile", "gebelik", "hamilelikte leke", "hamilelikte cilt",
      "gebelik maskesi", "hamile güvenli",
    ],
    categories: ["nemlendirici", "serum", "güneş", "yüz bakım", "cilt bakım"],
    concernKeywords: ["hamilelik güvenli", "gebelik"],
    ingredientSignals: [
      "vitamin c", "alpha arbutin", "azelaic", "hyaluronic",
      "glycerin", "ceramide", "niacinamide",
    ],
    excludeCategories: ["retinol", "peeling güçlü"],
  },

  // ── 14. SAÇ KIRILMASI ────────────────────────────────────────────────────────
  {
    id: "sac_kirilmasi",
    label_tr: "Saç Kırılması & Zayıf Saç",
    flowId: "sac",
    icon: "scissors",
    color: "#B45309",
    aliases: [
      "saç kırılıyor", "kırık saç", "saç teli kırılıyor", "saç zayıflığı",
      "saç elektrikleniyor", "kuru saç",
    ],
    categories: ["saç maskesi", "saç bakım", "saç kremi", "saç", "şampuan"],
    concernKeywords: ["saç güçlendirme", "saç bakımı"],
    ingredientSignals: [
      "keratin", "biotin", "collagen", "argan", "castor",
      "amino acid", "protein",
    ],
  },

  // ── 15. SEBOREİK DERMATİT ───────────────────────────────────────────────────
  {
    id: "seboreik_dermatit",
    label_tr: "Seboreik Dermatit",
    flowId: "hassasiyet",
    icon: "alert-triangle",
    color: "#D97706",
    aliases: [
      "seboreik dermatit", "seboreik", "yağlı kepek", "yüz kepeği",
      "kaş üstü pullanma", "alın pullanması",
    ],
    categories: ["temizleyici", "şampuan", "krem", "serum", "saç bakım"],
    concernKeywords: ["seboreik dermatit"],
    ingredientSignals: [
      "zinc pyrithione", "ketoconazole", "selenium", "salicylic",
      "piroctone", "tea tree",
    ],
  },

  // ── 16. MELAZMA ──────────────────────────────────────────────────────────────
  {
    id: "melazma",
    label_tr: "Melazma & Kloazma",
    flowId: "leke",
    icon: "zap",
    color: "#9333EA",
    aliases: [
      "melazma", "melasma", "kloazma", "gebelik lekesi", "hormonal leke",
      "yüz ortası lekesi",
    ],
    categories: ["serum", "krem", "güneş", "yüz bakım"],
    concernKeywords: ["melazma", "pigmentasyon"],
    ingredientSignals: [
      "tranexamic", "kojic", "alpha arbutin", "vitamin c",
      "azelaic", "niacinamide", "licorice",
    ],
  },

  // ── 17. BARIYER BOZUKLUĞU ────────────────────────────────────────────────────
  {
    id: "bariyer",
    label_tr: "Bariyer Bozukluğu",
    flowId: "kuruluk",
    icon: "shield",
    color: "#065F46",
    aliases: [
      "bariyer", "bariyer bozulması", "bariyer zayıflığı",
      "cilt bariyeri", "geçirgen cilt",
    ],
    categories: ["nemlendirici", "krem", "serum", "cilt bakım", "yüz bakım"],
    concernKeywords: ["bariyer", "nem kilitleme"],
    ingredientSignals: [
      "ceramide", "fatty acid", "cholesterol", "phytosphingosine",
      "squalane", "sodium pca",
    ],
  },

  // ── 18. VÜCUT KURULUĞU ───────────────────────────────────────────────────────
  {
    id: "vücut_kurulugu",
    label_tr: "Vücut Kuruluğu",
    flowId: "kuruluk",
    icon: "cloud",
    color: "#1D4ED8",
    aliases: [
      "vücut kuruluğu", "el kuruluğu", "bacak kuruluğu", "vücut kremı",
      "kuru deri vücut", "el kremi",
    ],
    categories: ["vücut losyonu", "vücut kremi", "vücut", "el kremi", "losyon"],
    concernKeywords: ["vücut kuruluğu", "nem"],
    ingredientSignals: [
      "shea", "urea", "glycerin", "ceramide", "lactic acid",
      "hyaluronic", "cocoa butter",
    ],
  },

  // ── 19. DUDAK BAKIMI ─────────────────────────────────────────────────────────
  {
    id: "dudak",
    label_tr: "Dudak Bakımı",
    flowId: "kuruluk",
    icon: "smile",
    color: "#E11D48",
    aliases: [
      "dudak", "dudak kuruluğu", "çatlak dudak", "lip balm",
      "dudak bakım", "lip care",
    ],
    categories: ["dudak", "lip"],
    concernKeywords: ["dudak"],
    ingredientSignals: ["shea", "beeswax", "vitamin e", "spf"],
  },

  // ── 20. SEDEF ────────────────────────────────────────────────────────────────
  {
    id: "sedef",
    label_tr: "Sedef Hastalığı",
    flowId: "hassasiyet",
    icon: "activity",
    color: "#7C3AED",
    aliases: [
      "sedef", "sedef hastalığı", "psoriasis", "psoriazis",
      "cilt pullanması", "gümüş renkli plak",
    ],
    categories: ["nemlendirici", "krem", "vücut", "cilt bakım"],
    concernKeywords: ["sedef", "psoriasis"],
    ingredientSignals: [
      "coal tar", "salicylic", "urea", "shea", "aloe",
      "ceramide",
    ],
  },

  // ── 21. KONTAKT DERMATİT ─────────────────────────────────────────────────────
  {
    id: "kontakt_dermatit",
    label_tr: "Kontakt Dermatit & Alerji",
    flowId: "hassasiyet",
    icon: "alert-circle",
    color: "#DC2626",
    aliases: [
      "kontakt dermatit", "kontakt", "ürün alerjisi", "kozmetik alerjisi",
      "cilt reaksiyonu", "ürün yakıyor",
    ],
    categories: ["nemlendirici", "krem", "serum", "cilt bakım"],
    concernKeywords: ["alerji güvenli", "hipoalerjenik"],
    ingredientSignals: [
      "allantoin", "panthenol", "aloe", "ceramide",
      "glycerin",
    ],
    excludeCategories: ["parfüm", "boyalı"],
  },

  // ── 22. GÜNEŞ HASSASİYETİ ────────────────────────────────────────────────────
  {
    id: "gunes_hassasiyeti",
    label_tr: "Güneş Hassasiyeti",
    flowId: "gunes",
    icon: "sun",
    color: "#B45309",
    aliases: [
      "güneş hassasiyeti", "güneşe hassas", "fotosensitivite",
      "güneşe çıkınca", "güneşten etkilenme",
    ],
    categories: ["güneş", "spf", "güneş koruma"],
    concernKeywords: ["güneş hassasiyeti", "spf"],
    ingredientSignals: [
      "spf", "titanium", "zinc oxide",
    ],
  },

  // ── 23. GELİŞİMSEL ÇATLAKLAR ─────────────────────────────────────────────────
  {
    id: "gerilme_izleri",
    label_tr: "Gerilme İzleri (Çatlak)",
    flowId: "kuruluk",
    icon: "zap",
    color: "#6D28D9",
    aliases: [
      "çatlak", "çatlak izi", "gerilme izi", "streç mark", "stretch mark",
      "stria",
    ],
    categories: ["vücut", "vücut kremi", "vücut yağı", "serum"],
    concernKeywords: ["çatlak", "gerilme izi"],
    ingredientSignals: [
      "centella", "vitamin e", "retinol", "hyaluronic",
      "collagen", "bio-oil",
    ],
  },

  // ── 24. SELÜLİT ──────────────────────────────────────────────────────────────
  {
    id: "selülit",
    label_tr: "Selülit",
    flowId: "kuruluk",
    icon: "layers",
    color: "#0891B2",
    aliases: [
      "selülit", "portakal kabuğu görünümü", "bacak selülit",
      "selülit kremi",
    ],
    categories: ["vücut", "vücut kremi", "serum"],
    concernKeywords: ["selülit"],
    ingredientSignals: [
      "caffeine", "retinol", "centella", "l-carnitine",
    ],
  },

  // ── 25. BOYUN & DEKOLTE ───────────────────────────────────────────────────────
  {
    id: "boyun_dekolte",
    label_tr: "Boyun & Dekolte Bakımı",
    flowId: "leke",
    icon: "chevrons-down",
    color: "#9333EA",
    aliases: [
      "boyun", "boyun bakım", "dekolte", "boyun kırışıklığı",
      "boyun lekesi",
    ],
    categories: ["vücut", "krem", "serum", "yüz bakım"],
    concernKeywords: ["boyun", "dekolte"],
    ingredientSignals: [
      "retinol", "peptide", "vitamin c", "niacinamide",
    ],
  },

  // ── 26. PERİORAL DERMATİT ────────────────────────────────────────────────────
  {
    id: "perioral",
    label_tr: "Perioral Dermatit",
    flowId: "hassasiyet",
    icon: "circle",
    color: "#BE123C",
    aliases: [
      "perioral", "perioral dermatit", "ağız çevresi döküntü",
      "bıyık üstü döküntü",
    ],
    categories: ["nemlendirici", "serum", "krem"],
    concernKeywords: ["perioral"],
    ingredientSignals: ["azelaic", "niacinamide", "aloe"],
    excludeCategories: ["steroid", "kortizol"],
  },

  // ── 27. HİPERPİGMENTASYON ────────────────────────────────────────────────────
  {
    id: "hiperpigmentasyon",
    label_tr: "Hiperpigmentasyon",
    flowId: "leke",
    icon: "circle",
    color: "#7C3AED",
    aliases: [
      "hiperpigmentasyon", "hiperpigment", "pih",
      "post inflamatuar", "akne sonrası leke",
    ],
    categories: ["serum", "krem", "peeling", "yüz bakım"],
    concernKeywords: ["hiperpigmentasyon", "leke"],
    ingredientSignals: [
      "alpha arbutin", "kojic", "tranexamic", "vitamin c",
      "niacinamide", "azelaic",
    ],
  },

  // ── 28. KIL DÖNMESİ ──────────────────────────────────────────────────────────
  {
    id: "kil_donmesi",
    label_tr: "Kıl Dönmesi (Ingrown Hair)",
    flowId: "hassasiyet",
    icon: "arrow-down",
    color: "#065F46",
    aliases: [
      "kıl dönmesi", "ingrown hair", "tıraş altı sivilce",
      "epilasyon sonrası", "ağda sonrası",
    ],
    categories: ["serum", "vücut", "peeling"],
    concernKeywords: ["kıl dönmesi"],
    ingredientSignals: ["salicylic", "glycolic", "tea tree"],
  },

  // ── 29. ÜRÜN ÖNERİSİ (GENEL) ─────────────────────────────────────────────────
  {
    id: "genel_bakim",
    label_tr: "Genel Cilt Bakımı",
    flowId: "kuruluk",
    icon: "package",
    color: "#3D6E56",
    aliases: [
      "cilt bakım", "rutin", "temel rutin", "başlangıç rutini",
      "günlük bakım", "skin care",
    ],
    categories: ["temizleyici", "nemlendirici", "serum", "güneş", "tonik"],
    concernKeywords: [],
    ingredientSignals: [],
  },

  // ── 30. YAĞ KONTROLÜ (KARMA CİLT) ────────────────────────────────────────────
  {
    id: "karma_cilt",
    label_tr: "Karma Cilt Bakımı",
    flowId: "akne",
    icon: "sliders",
    color: "#CA8A04",
    aliases: [
      "karma cilt", "t bölgesi", "yağlı t bölge", "hem yağlı hem kuru",
      "kombine cilt",
    ],
    categories: ["nemlendirici", "serum", "temizleyici", "tonik"],
    concernKeywords: ["karma cilt", "yağlı t bölgesi"],
    ingredientSignals: ["niacinamide", "hyaluronic", "glycerin"],
  },
];

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/** flowId'ye göre en uygun ConcernEntry'yi döndürür */
export function getConcernEntryByFlowId(flowId: string): ConcernEntry | undefined {
  // Exact ID match first
  const byId = CONCERN_DICTIONARY.find(e => e.id === flowId);
  if (byId) return byId;
  // Then flowId match
  return CONCERN_DICTIONARY.find(e => e.flowId === flowId);
}

/** Birden fazla ConcernEntry flowId'ye göre */
export function getConcernEntriesByFlowId(flowId: string): ConcernEntry[] {
  return CONCERN_DICTIONARY.filter(e => e.flowId === flowId || e.id === flowId);
}

/** Query string'e göre en iyi eşleşen ConcernEntry'yi döndürür */
export function matchConcernEntry(query: string): { entry: ConcernEntry; score: number } | null {
  const q = normalizeTR(query);
  if (q.length < 2) return null;

  let best: { entry: ConcernEntry; score: number } | null = null;

  for (const entry of CONCERN_DICTIONARY) {
    let score = 0;
    for (const alias of entry.aliases) {
      const a = normalizeTR(alias);
      if (q === a) { score = Math.max(score, 100); break; }
      if (q.includes(a) && a.length >= 3) { score = Math.max(score, 90); }
      if (a.includes(q) && q.length >= 3) { score = Math.max(score, 82); }
      if (a.startsWith(q) && q.length >= 3) { score = Math.max(score, 87); }
      if (q.startsWith(a) && a.length >= 3) { score = Math.max(score, 84); }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best && best.score >= 50 ? best : null;
}

/** İlk N popüler endişeyi döndürür (fallback için) */
export function getTopConcerns(n: number): ConcernEntry[] {
  const topIds = ["akne", "hassasiyet", "leke", "kuruluk", "gunes", "sac_dokulmesi"];
  return topIds.slice(0, n).map(id => CONCERN_DICTIONARY.find(e => e.id === id)!).filter(Boolean);
}
