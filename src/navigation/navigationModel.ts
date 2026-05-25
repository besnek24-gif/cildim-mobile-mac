export type NavigationSource =
  | "home"
  | "search"
  | "category"
  | "product"
  | "compare"
  | "routine"
  | "unknown";

export type NavigationSuggestion = {
  id: string;
  label: string;
  title?: string;
  route?: string;
  href?: string;
  source?: NavigationSource;
  [key: string]: unknown;
};

export function parseNavigationSource(value?: unknown): NavigationSource {
  const raw = String(value ?? "").toLowerCase();

  if (raw.includes("home") || raw.includes("ana")) return "home";
  if (raw.includes("search") || raw.includes("ara")) return "search";
  if (raw.includes("category") || raw.includes("kategori")) return "category";
  if (raw.includes("product") || raw.includes("urun") || raw.includes("ürün")) return "product";
  if (raw.includes("compare") || raw.includes("mukayese") || raw.includes("karşılaştır")) return "compare";
  if (raw.includes("routine") || raw.includes("rutin")) return "routine";

  return "unknown";
}

export function findSuggestion(
  suggestions: NavigationSuggestion[] = [],
  query?: string
): NavigationSuggestion | undefined {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return suggestions[0];

  return suggestions.find((item) => {
    const haystack = [
      item.id,
      item.label,
      item.title,
      item.route,
      item.href,
      item.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function normalizeNavigationQuery(value?: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export const navigationSuggestions: NavigationSuggestion[] = [];


export function getBackLabel(source?: unknown): string {
  const parsed = parseNavigationSource(source);
  const labels: Record<string, string> = {
    home: "Ana sayfa",
    search: "Arama",
    category: "Kategori",
    product: "Ürün",
    compare: "Mukayese",
    routine: "Rutin",
    unknown: "Geri",
  };
  return labels[parsed] || "Geri";
}

export function getBackHref(source?: unknown): string {
  const parsed = parseNavigationSource(source);
  const hrefs: Record<string, string> = {
    home: "/",
    search: "/(tabs)/(home)/ara",
    category: "/(tabs)/(home)/tum-urunler",
    product: "/(tabs)/(home)/tum-urunler",
    compare: "/(tabs)/(home)/mukayese-baslat",
    routine: "/(tabs)/(home)/rutinim",
    unknown: "/",
  };
  return hrefs[parsed] || "/";
}

export const NAVIGATION_SOURCE_LABELS = {
  home: "Ana sayfa",
  search: "Arama",
  category: "Kategori",
  product: "Ürün",
  compare: "Mukayese",
  routine: "Rutin",
  unknown: "Geri",
};

