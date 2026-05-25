export type IntentKey =
  | "general"
  | "acne"
  | "spot"
  | "sunscreen"
  | "moisture"
  | "hair"
  | "cleanser";

export type SearchIntentDefinition = {
  key: IntentKey;
  label: string;
  keywords: string[];
};

export const SEARCH_INTENTS: Record<IntentKey, SearchIntentDefinition> = {
  general: {
    key: "general",
    label: "Genel arama",
    keywords: [],
  },
  acne: {
    key: "acne",
    label: "Akne / sivilce",
    keywords: ["akne", "sivilce", "komedon", "yağlanma"],
  },
  spot: {
    key: "spot",
    label: "Leke / ton eşitsizliği",
    keywords: ["leke", "ton", "pigment", "c vitamini"],
  },
  sunscreen: {
    key: "sunscreen",
    label: "Güneş koruması",
    keywords: ["güneş", "gunes", "spf", "uv", "koruyucu"],
  },
  moisture: {
    key: "moisture",
    label: "Nem / bariyer",
    keywords: ["nem", "kuruluk", "bariyer", "hassas"],
  },
  hair: {
    key: "hair",
    label: "Saç bakımı",
    keywords: ["saç", "sac", "dökülme", "dokulme", "kepek"],
  },
  cleanser: {
    key: "cleanser",
    label: "Temizleyici",
    keywords: ["temizleyici", "jel", "yıkama", "yikama"],
  },
};

export const DEFAULT_INTENT_KEY: IntentKey = "general";
