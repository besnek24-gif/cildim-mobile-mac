/**
 * CiltBakımım — Akıllı Endişe Arama & Eşleştirme Motoru
 * Tıbbi terimler, günlük dil, eş anlamlılar ve yazım yanlışlarını destekler.
 * Genişletilebilir yapı: CONCERN_TERM_MAP'e yeni girdi eklemek yeterli.
 */

export type FlowId = "akne" | "hassasiyet" | "leke" | "kuruluk" | "gunes" | "sac";

export interface SearchMatch {
  flowId: FlowId;
  flowLabel: string;
  flowSubtitle: string;
  flowColor: string;
  flowIcon: string;
  confidence: number;
  matchedTerm: string;
  note?: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  query: string;
  hasResults: boolean;
}

// ─── Flow meta ────────────────────────────────────────────────────────────────

const FLOW_META: Record<FlowId, { label: string; subtitle: string; color: string; icon: string }> = {
  akne:       { label: "Akne",          subtitle: "Sivilce ve pütür bakımı",          color: "#15803D", icon: "droplet"  },
  hassasiyet: { label: "Hassasiyet",    subtitle: "Kızarıklık ve hassas cilt bakımı", color: "#BE123C", icon: "heart"    },
  leke:       { label: "Leke",          subtitle: "Ton eşitsizliği ve iz bakımı",      color: "#7C3AED", icon: "zap"      },
  kuruluk:    { label: "Kuruluk",       subtitle: "Nem ve bariyer desteği",            color: "#1D4ED8", icon: "cloud"    },
  gunes:      { label: "Güneş Koruma",  subtitle: "SPF seçimi ve güneş bakımı",        color: "#B45309", icon: "sun"      },
  sac:        { label: "Saç Dökülmesi", subtitle: "Dökülme ve güçlendirme",            color: "#C2410C", icon: "wind"     },
};

export const ALL_FLOW_IDS: FlowId[] = ["akne", "hassasiyet", "leke", "kuruluk", "gunes", "sac"];

export function getFlowMeta(id: FlowId) {
  return FLOW_META[id];
}

// ─── Türkçe karakter normalizer ────────────────────────────────────────────────

export function normalizeTR(s: string): string {
  return s
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .trim();
}

// ─── Terim eşleştirme veritabanı ──────────────────────────────────────────────
// Her entry: { flowId, terms[], note? }
// Bir terim birden fazla entry'de geçebilir → multi-concern desteği

interface TermEntry {
  flowId: FlowId;
  terms: string[];
  note?: string;
}

const CONCERN_TERM_MAP: TermEntry[] = [

  // ─────────────────────────────────────────────────────────────────────────────
  // AKNE
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "akne",
    terms: [
      // Temel
      "sivilce", "sivilceli", "sivilcelerim", "sivilce var", "sivilce çıkıyor",
      "akne", "acne", "pimple", "pimples",
      // Tipler
      "siyah nokta", "blackhead", "beyaz nokta", "whitehead", "komedon", "comedon",
      "kistik akne", "kistik sivilce", "kist", "nodüler akne", "papül", "püstül",
      // Görünüm
      "pütür", "pütürlü", "kabarcik", "kabarciklar", "yüzümde çıkıyor",
      "iltihaplı", "iltihaplı sivilce", "iltihap", "iltihaplanma",
      // Yağ / Gözenek
      "yağlı cilt", "yağlılık", "yağlanma", "aşırı yağlanma", "yüzüm yağlanıyor",
      "sebum", "gözenek", "gözeneğim", "tıkali gözenek", "büyük gözenek",
      // Özel tipler
      "fungal akne", "fungal", "mantar akne", "pityrosporum",
      // İz ve döngü
      "sivilce izi", "akne izi", "akne sonrası", "iz bırakıyor",
      // Hormonal / Dönemsel
      "hormonal akne", "adet sivilce", "adet öncesi", "hormonal",
      // Bölgesel
      "çene sivilcesi", "alın sivilcesi", "sırt sivilcesi", "boyun sivilcesi",
      // Günlük dil
      "ben çıkıyor", "ben var", "yüzüm bozuk", "cilt bozukluğu",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HASSASİYET
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "hassasiyet",
    terms: [
      // Temel
      "hassasiyet", "hassas", "hassas cilt", "cildin hassas",
      // Kızarıklık
      "kızarıklık", "kızarık", "kızarıyor", "cildi kızarıyor", "yüzüm kızarıyor",
      "kızarma", "yüz kızarması",
      // Tıbbi terimler
      "rozasea", "rosacea", "rozasya", "rosasea",
      "egzama", "egzema", "eczema", "ekzema",
      "atopik", "atopi", "atopik dermatit", "atopik dermatiit",
      "sedef", "sedef hastalığı", "psoriasis", "psoriazis",
      "dermatiit", "kontakt dermatiit", "seboreik dermatiit", "dermit",
      "perioral dermatiit",
      "urtiker", "kurdeşen", "ürtiker",
      "anjiyoödem",
      "kouperoz", "kuperos", "couperose",
      "kapillar", "kılcal damar", "kılcal damarlar görünüyor",
      // Belirti
      "yanma", "yanıyor", "cildi yanıyor", "cildim yanıyor", "yüzüm yanıyor",
      "batma", "batıyor", "cildim batıyor",
      "kaşınma", "kaşınıyor", "cildim kaşınıyor",
      "tahriş", "tahrişli", "kolay tahriş",
      "reaksiyon", "cilt reaksiyonu", "ürün reaksiyonu",
      // Hassasiyet sebepleri
      "alerjik", "alerji", "cilt alerjisi", "kozmetik alerjisi",
      // Günlük dil
      "ürün yakıyor", "her şeye tepki veriyor", "her ürün yakıyor",
      "cildim hassas", "cildim çok kötü",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LEKE
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "leke",
    terms: [
      // Temel
      "leke", "lekeli", "lekeler", "leke var", "lekelerim",
      // Tıbbi
      "melazma", "melasma", "kloazma",
      "hiperpigmentasyon", "hiperpigment", "pigmentasyon",
      // Güneş kaynaklı
      "güneş lekesi", "güneş hasarı", "güneş yanığı izi",
      "fotoyaşlanma", "photoaging", "fotoajing",
      // İz kaynaklı
      "sivilce izi", "akne izi", "post inflamatuar", "pih",
      "kızıllık izi", "yara izi",
      // Görünüm
      "koyu leke", "koyu iz", "koyu halka",
      "ton eşitsizliği", "cilt tonu", "kararmış", "kararma",
      "mat görünüm", "cilt rengi eşit değil", "eşit değil",
      "aydınlatma", "aydınlık cilt", "parlaklık",
      // Bölgesel
      "göz altı morluğu", "göz altı kararması", "koyu halka",
      "el lekesi", "vücut lekesi",
      // Günlük dil
      "rengim eşit değil", "yüzüm mat", "iz var",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // KURULUK
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "kuruluk",
    terms: [
      // Temel
      "kuruluk", "kuru", "kuru cilt", "cildim kuru",
      "nemsizlik", "nem eksikliği", "nemlendirme",
      // Hisler
      "gergin cilt", "gerginlik", "gergin hissediyorum", "gerilme",
      "pul pul", "pullanma", "pullanıyor", "soyulma", "soyuluyor",
      "çatlamak", "çatlak", "çatlayan", "çatlıyor",
      // Mevsimsel
      "kış kurulugu", "kış cildi", "mevsim geçişi",
      // Bariyer
      "bariyer", "bariyer bozulması", "bariyer zayıflığı",
      "su kaybı", "tewl", "nem kaybı",
      // Günlük dil
      "yüzüm kuruyor", "cildi geriliyor", "yıkayınca kuruyor",
      "nemlendirici işe yaramıyor", "nem tutmuyor",
      "soyuluyor", "boyuyor",
      // Bölgesel
      "dudak kuruluğu", "el kuruluğu", "vücut kuruluğu",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GÜNEŞ
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "gunes",
    terms: [
      // Temel
      "güneş", "güneş koruma", "güneş koruyucu", "güneş kremi",
      "spf", "sunscreen", "sun cream", "güneş filtresi",
      // UV
      "uv", "uva", "uvb", "uv koruma", "uv hasarı",
      // Bronzlaşma / Yanma
      "güneş yanığı", "bronzlaşma", "güneşten yanmak",
      "güneşe çıkınca", "güneşe hassas",
      // Yaşlanma
      "güneş hasarı", "photoaging", "fotoajing", "güneşten yaşlanma",
      // Günlük dil
      "spf ne kullanayım", "güneş kremi seçimi", "spf seçimi",
      "hangi spf", "kaç spf", "spf 50", "spf 30",
      "yazın ne kullanayım", "yazlık krem",
    ],
    note: "Leke ile birlikte değerlendirilebilir",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SAÇ DÖKÜLMESİ
  // ─────────────────────────────────────────────────────────────────────────────
  {
    flowId: "sac",
    terms: [
      // Temel
      "saç dökülmesi", "saç dökülüyor", "saçım dökülüyor", "dökülen saç",
      "dökülme", "saç incelmesi", "saç seyrelmesi",
      // Tıbbi
      "alopesi", "alopecia", "androgenetic", "telogen", "effluvium",
      "androgenetik alopesi", "telogen effluvium",
      // Kepek
      "kepek", "kepekli", "kepek sorunu", "kepek var",
      "seboreik dermatit saç derisi",
      // Saç derisi
      "saç derisi", "scalp", "kafa derisi", "saç derisi yağlanması",
      "saç derisi hassasiyeti", "saç derisi kaşıntısı",
      // Saç tipleri
      "yağlı saç", "kuru saç",
      // Saç kırılması
      "saç kırılıyor", "kırık saç", "saç teli kırılıyor",
      // Günlük dil
      "saçım azalıyor", "saçım gidiyor", "saçım inceliyor",
      "saç büyüme", "saç uzatma", "saç güçlendirme",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ÇAPRAZ KAYITLAR (multi-concern)
  // ─────────────────────────────────────────────────────────────────────────────

  // Egzama → hassasiyet + kuruluk
  {
    flowId: "kuruluk",
    terms: [
      "egzama", "egzema", "eczema", "ekzema",
      "atopik", "atopi", "atopik dermatit",
    ],
    note: "Hassasiyet ile birlikte değerlendirilebilir",
  },
  // Güneş lekesi → leke + güneş
  {
    flowId: "leke",
    terms: [
      "güneş lekesi", "photoaging", "fotoajing", "uv hasarı",
      "güneş hasarı",
    ],
    note: "Güneş koruması ile birlikte değerlendirilebilir",
  },
  // Sivilce izi → akne + leke
  {
    flowId: "leke",
    terms: [
      "sivilce izi", "akne izi", "post inflamatuar", "pih",
    ],
    note: "Akne ile birlikte değerlendirilebilir",
  },
  // Kepek → saç + hassasiyet
  {
    flowId: "hassasiyet",
    terms: ["kepek", "kepekli", "seboreik dermatit saç derisi"],
    note: "Saç derisi hassasiyeti ile ilişkili",
  },
  // Yağlı cilt sivilce → akne + yağ kontrolü
  {
    flowId: "akne",
    terms: ["yağlı cilt", "yağlanıyor", "aşırı yağlanma", "yağ kontrolü"],
    note: "Yağlı cilt akne riski taşır",
  },
];

// ─── Levenshtein uzaklığı (typo desteği) ─────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Confidence hesaplama ──────────────────────────────────────────────────────

function scoreMatch(query: string, term: string): number {
  const q = normalizeTR(query);
  const t = normalizeTR(term);

  if (q === t) return 100;
  if (q.includes(t) && t.length >= 3) return 90;
  if (t.includes(q) && q.length >= 3) return 82;
  if (t.startsWith(q) && q.length >= 3) return 87;
  if (q.startsWith(t) && t.length >= 3) return 84;

  // Çok kelimeli sorguyu kelimelere böl, her kelimeyi karşılaştır
  const qWords = q.split(/\s+/).filter(w => w.length >= 3);
  for (const word of qWords) {
    if (t === word) return 90;
    if (t.includes(word) && word.length >= 3) return 78;
    if (t.startsWith(word) && word.length >= 3) return 76;
  }

  // Fuzzy (Levenshtein)
  if (q.length >= 3 && t.length >= 3) {
    const dist = levenshtein(q, t);
    if (dist === 1) return 72;
    if (dist === 2 && t.length >= 5) return 56;
    if (dist === 3 && t.length >= 7) return 46;
  }
  return 0;
}

// ─── Ana arama fonksiyonu ──────────────────────────────────────────────────────
// THRESHOLD: 45 → daha geniş fuzzy yakalama

const MATCH_THRESHOLD = 45;

export function searchConcern(rawQuery: string): SearchResult {
  const query = rawQuery.trim();

  if (query.length < 2) {
    return { matches: [], query, hasResults: false };
  }

  const words = normalizeTR(query).split(/\s+/).filter(w => w.length >= 2);

  const flowScores: Map<FlowId, { confidence: number; matchedTerm: string; note?: string }> = new Map();

  for (const entry of CONCERN_TERM_MAP) {
    for (const term of entry.terms) {
      let conf = scoreMatch(query, term);

      if (conf === 0) {
        for (const word of words) {
          const c = scoreMatch(word, term);
          if (c > conf) conf = c;
        }
      }

      if (conf >= MATCH_THRESHOLD) {
        const existing = flowScores.get(entry.flowId);
        if (!existing || conf > existing.confidence) {
          flowScores.set(entry.flowId, {
            confidence: conf,
            matchedTerm: term,
            note: entry.note,
          });
        }
      }
    }
  }

  const matches: SearchMatch[] = Array.from(flowScores.entries())
    .map(([flowId, { confidence, matchedTerm, note }]) => ({
      flowId,
      flowLabel:    FLOW_META[flowId].label,
      flowSubtitle: FLOW_META[flowId].subtitle,
      flowColor:    FLOW_META[flowId].color,
      flowIcon:     FLOW_META[flowId].icon,
      confidence,
      matchedTerm,
      note,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return {
    matches,
    query,
    hasResults: matches.length > 0,
  };
}

// ─── Açıklayıcı mesaj üretici ─────────────────────────────────────────────────

export function buildSearchMessage(result: SearchResult): string {
  if (!result.hasResults) return "";
  const { matches } = result;
  if (matches.length === 1) {
    return `Bu durum ${matches[0].flowLabel.toLowerCase()} ile ilişkili görünüyor.`;
  }
  if (matches.length === 2) {
    return `Bu durum ${matches[0].flowLabel.toLowerCase()} ve ${matches[1].flowLabel.toLowerCase()} ile ilişkili olabilir.`;
  }
  return `${matches[0].flowLabel}, ${matches[1].flowLabel} veya ${matches[2].flowLabel} ile ilgili olabilir.`;
}
