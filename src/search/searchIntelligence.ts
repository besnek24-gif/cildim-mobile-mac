export type SearchIntentResult = {
  key: string;
  intentKey: string;
  label: string;
  confidence: number;
  query: string;
  tokens: string[];
};

export function normalizeSearchText(value?: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchText(value?: unknown): string[] {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

export function detectSearchIntent(query?: unknown): SearchIntentResult {
  const normalized = normalizeSearchText(query);
  const tokens = tokenizeSearchText(query);

  const has = (...words: string[]) => words.some((w) => normalized.includes(w));

  let key = "general";
  let label = "Genel arama";
  let confidence = normalized ? 0.45 : 0;

  if (has("akne", "sivilce")) {
    key = "acne";
    label = "Akne / sivilce";
    confidence = 0.85;
  } else if (has("leke", "ton", "pigment")) {
    key = "spot";
    label = "Leke / ton eşitsizliği";
    confidence = 0.8;
  } else if (has("gunes", "spf", "uv", "koruyucu")) {
    key = "sunscreen";
    label = "Güneş koruması";
    confidence = 0.85;
  } else if (has("nem", "kuruluk", "bariyer")) {
    key = "moisture";
    label = "Nem / bariyer";
    confidence = 0.78;
  } else if (has("sac", "dokulme", "kepek")) {
    key = "hair";
    label = "Saç bakımı";
    confidence = 0.78;
  } else if (has("temizleyici", "jel", "yikama")) {
    key = "cleanser";
    label = "Temizleyici";
    confidence = 0.78;
  }

  return {
    key,
    intentKey: key,
    label,
    confidence,
    query: normalized,
    tokens,
  };
}

export function searchTextIncludes(source?: unknown, query?: unknown): boolean {
  const s = normalizeSearchText(source);
  const q = normalizeSearchText(query);
  if (!q) return true;
  return s.includes(q);
}
