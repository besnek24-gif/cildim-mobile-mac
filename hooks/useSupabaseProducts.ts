import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabaseClient";
import type { Product } from "@/types/product";
import { adaptLegacyProduct } from "@/src/search/productAdapter";
import perf from "@/src/utils/performanceLogger";

const _API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

// ── Ecz4 PERF: Phase 2 ingredients lazy hydration ───────────────────────────
// HOME_FIELDS'tan `ingredients` çıkarıldı (~500KB payload tasarrufu).
// İlk paint sonrası bu fonksiyon background'da `id, ingredients` çeker ve
// products state'ine merge eder. Tip→ürün eşleme + featureBadges hidrate
// olduktan sonra tam çalışır; öncesinde graceful degradation (toStringArray
// undefined'ı boş array'e dönüştürür, optional access throw etmez).
//
// Lifecycle güvenliği: Subscriber Set pattern. Her hook instance kendi
// setProducts'ını mount'ta `productsSubscribers`'a ekler, unmount'ta
// çıkarır. Hydration yalnızca LIVE setter'lara broadcast eder; unmount
// olmuş bileşenlere setState çağrılmaz (no React warning, no leak).
//
// Singleflight: paralel mount eden hook instance'ları aynı promise'i paylaşır.
// TTL: 5 dakika içinde tekrar çalıştırılmaz (memory mirror tazedir).
// Failsafe: hata durumunda sessizce iptal — Home state asla bozulmaz.
type ProductsSetter = React.Dispatch<React.SetStateAction<Product[]>>;
const productsSubscribers = new Set<ProductsSetter>();
let inflightIngredientsHydration: Promise<void> | null = null;
let lastIngredientsHydratedAt = 0;
const INGREDIENTS_HYDRATION_TTL_MS = 5 * 60 * 1000;

async function hydrateIngredientsBackground(): Promise<void> {
  if (inflightIngredientsHydration) return inflightIngredientsHydration;
  if (Date.now() - lastIngredientsHydratedAt < INGREDIENTS_HYDRATION_TTL_MS) {
    return;
  }

  inflightIngredientsHydration = (async () => {
    try {
      // Microtask gecikmesi: ilk Home paint'in commit edilmesini bekle,
      // böylece bu fetch FlatList reconciliation ile yarışmaz.
      await new Promise<void>((res) => setTimeout(res, 0));

      const PAGE_SIZE = 1000;
      const MAX_PAGES = 50;
      const byId = new Map<string, unknown>();
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("products")
          .select("id, ingredients")
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error || !data || data.length === 0) break;
        for (const row of data) {
          const rid = (row as any)?.id;
          if (rid != null) byId.set(String(rid), (row as any).ingredients);
        }
        if (data.length < PAGE_SIZE) break;
      }

      if (byId.size === 0) return;

      // Functional update factory — broadcast to all live subscribers.
      // sameProductListById id+order+dermo_score karşılaştırır; ingredients
      // değişimini farketmediği için yeni array referansı zorunludur.
      const merger = (prev: Product[]): Product[] => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((p) => {
          const ing = byId.get(String((p as any).id));
          if (ing == null) return p;
          if ((p as any).ingredients === ing) return p;
          changed = true;
          return { ...p, ingredients: ing } as Product;
        });
        if (!changed) return prev;
        return next;
      };

      // Memory mirror'ı önce güncelle ki bir sonraki Home mount (subscribe
      // sırasında) hidrate satırlarla başlasın.
      if (memoryHomeProducts) {
        memoryHomeProducts = merger(memoryHomeProducts);
      }

      // Yalnızca LIVE setter'lara broadcast — unmount olanlara dokunmaz.
      for (const setter of productsSubscribers) {
        setter(merger);
      }

      lastIngredientsHydratedAt = Date.now();
    } catch (err) {
      if (__DEV__) {
        console.warn(
          "[Ecz4][IngredientsHydration] background fetch skipped:",
          (err as Error)?.message ?? "unknown",
        );
      }
    } finally {
      inflightIngredientsHydration = null;
    }
  })();

  return inflightIngredientsHydration;
}

// ── Ecz4 PERF — Phase 2a: short_description background hydration ──────────
// HOME_FIELDS'tan `short_description` çıkarıldı (~250-500 KB payload tasarrufu;
// ortalama 200-400 char × 1254 row). İlk paint sonrası bu fonksiyon
// background'da `id, short_description` çeker ve subscriber Set üzerinden
// merge eder.
//
// UI fallback (ProductCard.tsx:262): `short_benefit || short_description`
//   - Hidrasyon öncesi: yalnızca `short_benefit` görünür.
//   - Hidrasyon sonrası: `short_benefit` boş olan kartlarda `short_description`
//     fallback olarak devreye girer (gözle farkedilmez popup).
//   - Her ikisi de boşsa: kart alt satırı boş kalır (önceki davranışla aynı).
//
// Diğer tüketiciler:
//   - handleTipPress haystack (index.tsx:1702): undefined → push no-op
//     (graceful degradation; primary keyword'ler name/brand/category'den eşleşir)
//   - searchSupabaseProducts (line 695-696): direkt DB query'si `ilike` —
//     bu hidrasyondan bağımsız çalışır.
//
// Pattern mirror: hydrateIngredientsBackground (singleflight + 5dk TTL +
// setTimeout(0) defer + subscriber Set broadcast + sameProductListById no-op
// guard'ı bypass için yeni array referansı).
//
// Geri alma: bu fonksiyonu sil, HOME_FIELDS'a `short_description` ekle,
// `void hydrateShortDescriptionBackground()` çağrısını kaldır.
let inflightShortDescHydration: Promise<void> | null = null;
let lastShortDescHydratedAt = 0;
const SHORT_DESC_HYDRATION_TTL_MS = 5 * 60 * 1000;

async function hydrateShortDescriptionBackground(): Promise<void> {
  if (inflightShortDescHydration) return inflightShortDescHydration;
  if (Date.now() - lastShortDescHydratedAt < SHORT_DESC_HYDRATION_TTL_MS) {
    return;
  }

  inflightShortDescHydration = (async () => {
    try {
      // Microtask gecikmesi: ilk Home paint commit'ini bekle.
      await new Promise<void>((res) => setTimeout(res, 0));

      const PAGE_SIZE = 1000;
      const MAX_PAGES = 50;
      const byId = new Map<string, unknown>();
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("products")
          .select("id, short_description")
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error || !data || data.length === 0) break;
        for (const row of data) {
          const rid = (row as any)?.id;
          if (rid != null) byId.set(String(rid), (row as any).short_description);
        }
        if (data.length < PAGE_SIZE) break;
      }

      if (byId.size === 0) return;

      // Functional update factory — ID-bazlı merge, referential equality
      // korur (değer aynıysa aynı ürün referansı, değişen yoksa aynı array).
      const merger = (prev: Product[]): Product[] => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((p) => {
          const sd = byId.get(String((p as any).id));
          if (sd == null) return p;
          if ((p as any).short_description === sd) return p;
          changed = true;
          return { ...p, short_description: sd } as Product;
        });
        if (!changed) return prev;
        return next;
      };

      // Memory mirror'ı önce güncelle ki bir sonraki Home mount (subscribe
      // sırasında) hidrate satırlarla başlasın.
      if (memoryHomeProducts) {
        memoryHomeProducts = merger(memoryHomeProducts);
      }

      // Yalnızca LIVE setter'lara broadcast.
      for (const setter of productsSubscribers) {
        setter(merger);
      }

      lastShortDescHydratedAt = Date.now();
      if (__DEV__) {
        console.log(`[Ecz4][ShortDescHydration] applied (${byId.size} rows)`);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn(
          "[Ecz4][ShortDescHydration] background fetch skipped:",
          (err as Error)?.message ?? "unknown",
        );
      }
    } finally {
      inflightShortDescHydration = null;
    }
  })();

  return inflightShortDescHydration;
}

// ── Ecz4 PERF — Phase 2b: product_status background hydration ──────────────
// product_status query previously ran SYNCHRONOUSLY inside fetchProducts and
// blocked Home first paint with an extra Supabase round-trip (~100-200ms).
// Now the catalog renders immediately as "approved by default"; product_status
// is fetched in the background and prunes pending/rejected rows via the same
// subscriber Set broadcast pattern as ingredients hydration.
//
// Lifecycle safety:
//   - Singleflight: parallel mounts share one promise (no N×status queries).
//   - TTL: 5 dakika içinde tekrar çalıştırılmaz; refetch path TTL'yi reset etmez
//     ama moderasyon değişiklikleri nadirdir + memory mirror taze kalır.
//   - setTimeout(0): first paint commit'inin ardından çalışır → FlatList
//     reconciliation ile yarışmaz.
//   - Filter merger length değişmezse aynı array referansını döndürür → no-op
//     setState → gereksiz re-render yok.
//   - Failsafe: tablo yoksa / hata → sessizce iptal, tüm ürünler approved kalır
//     (önceki inline davranışla birebir aynı default).
//
// Geri alma: bu fonksiyonu sil; fetchProducts içinde `visibleProducts` atamasını
// önceki `try { await supabase.from("product_status")...} catch {}` bloğuyla
// değiştir; `void hydrateProductStatusBackground()` çağrısını kaldır.
let inflightStatusHydration: Promise<void> | null = null;
let lastStatusHydratedAt = 0;
const STATUS_HYDRATION_TTL_MS = 5 * 60 * 1000;

async function hydrateProductStatusBackground(): Promise<void> {
  if (inflightStatusHydration) return inflightStatusHydration;
  if (Date.now() - lastStatusHydratedAt < STATUS_HYDRATION_TTL_MS) {
    return;
  }

  inflightStatusHydration = (async () => {
    try {
      // Microtask gecikmesi: ilk Home paint commit'ini bekle.
      await new Promise<void>((res) => setTimeout(res, 0));

      const { data: statusData, error } = await supabase
        .from("product_status")
        .select("product_id, status");

      if (error || !statusData || statusData.length === 0) {
        lastStatusHydratedAt = Date.now();
        return;
      }

      const statusMap = new Map<string, string>();
      for (const row of statusData) {
        statusMap.set(row.product_id as string, row.status as string);
      }

      // Filtering merger: kaydı olmayan VEYA "approved" olan ürünleri tut;
      // diğerlerini ("pending", "rejected") çıkar. Inline davranışla birebir.
      const merger = (prev: Product[]): Product[] => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const next = prev.filter((p) => {
          const s = statusMap.get(String((p as any).id));
          return !s || s === "approved";
        });
        if (next.length === prev.length) return prev;
        return next;
      };

      // Memory mirror'ı önce güncelle ki bir sonraki Home mount (subscribe
      // sırasında) prune edilmiş satırlarla başlasın.
      if (memoryHomeProducts) {
        memoryHomeProducts = merger(memoryHomeProducts);
      }

      // Yalnızca LIVE setter'lara broadcast.
      for (const setter of productsSubscribers) {
        setter(merger);
      }

      lastStatusHydratedAt = Date.now();
      if (__DEV__) {
        console.log(`[Ecz4][StatusHydration] applied (${statusData.length} status rules)`);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn(
          "[Ecz4][StatusHydration] background fetch skipped:",
          (err as Error)?.message ?? "unknown",
        );
      }
    } finally {
      inflightStatusHydration = null;
    }
  })();

  return inflightStatusHydration;
}

// PERF: in-memory mirror of the most recently observed Home product list.
// Populated whenever AsyncStorage cache OR Supabase fetch yields rows. Read
// synchronously by useState lazy initializer so on warm app/remount the very
// first Home render already has products.length > 0 — eliminates the empty
// skeleton flash that AsyncStorage's async read window (~540ms) used to cause.
// This is *only* a render-seeding mirror; AsyncStorage remains the source of
// truth for cold launches (memoryHomeProducts resets on app process kill).
// To rollback: delete this constant and the two `memoryHomeProducts = ...`
// assignments + revert useState initializers to `[]` and `true`.
let memoryHomeProducts: Product[] | null = null;

// PERF: shallow id+order equality check used to suppress no-op setProducts
// calls from background refreshes. When the fresh Supabase fetch returns the
// same product ids in the same order as what is already on screen, we keep
// the previous reference instead of swapping in a brand-new array — this
// avoids gratuitous FlatList re-reconciliation of 1000+ rows.
// To rollback: drop this helper and the equality branch in setProducts(prev).
function sameProductListById(
  a: Product[] | null | undefined,
  b: Product[] | null | undefined,
): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as any;
    const bi = b[i] as any;
    if (String(ai?.id) !== String(bi?.id)) return false;
    // Eski cache'de dermo_score null olup taze fetch'te dolan satırlar
    // (post-backfill) için: skor değeri değiştiyse no-op'u atla, böylece
    // kartlar güncel skoru gösterir.
    if ((ai?.dermo_score ?? null) !== (bi?.dermo_score ?? null)) return false;
  }
  return true;
}

// PERF: stale-while-revalidate cache for Home product list. Persists the most
// recent lightweight Supabase fetch to AsyncStorage so the next cold open can
// paint products instantly while a fresh fetch runs in the background. Only
// the lightweight HOME_FIELDS rows are cached — full product details still go
// through fetchSupabaseProductById uncached. Search functions are unaffected.
// To rollback: drop the readHomeCache/writeHomeCache calls inside fetchProducts
// and remove the helper functions + cache constants below.
const HOME_CACHE_KEY = "home_products_cache_v1";
const HOME_CACHE_TS_KEY = "home_products_cache_ts_v1";
// Hard cap on persisted rows (~2 MB at ~400 B per lightweight row). Prevents
// runaway storage growth if catalog explodes.
const HOME_CACHE_MAX_ITEMS = 5000;

async function readHomeCache(): Promise<Product[] | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Product[];
  } catch {
    return null;
  }
}

async function writeHomeCache(products: Product[]): Promise<void> {
  try {
    const slice =
      products.length > HOME_CACHE_MAX_ITEMS
        ? products.slice(0, HOME_CACHE_MAX_ITEMS)
        : products;
    await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(slice));
    await AsyncStorage.setItem(HOME_CACHE_TS_KEY, String(Date.now()));
  } catch (err) {
    if (__DEV__) console.warn("[HomeCache] write failed:", err);
  }
}

// SAFE PERF PATCH 5 — Module-level fetch dedupe + TTL guard.
// ÖNCEDEN: useSupabaseProducts() 13 ekran tarafından çağrılıyor; her ekran
// mount'ta useEffect ile fetchProducts() ateşliyordu. SWR cache mirror
// sayesinde anlık paint vardı ama arka planda 13'e kadar concurrent paged
// Supabase fetch trafiği üretiliyordu (her biri 1-50 sayfa × 1000 satır +
// ardından product_status select).
//
// ŞİMDİ:
//  • lastProductsFetchAt — başarılı son network fetch'in unix ms timestamp'i.
//  • inflightProductsFetch — şu anda devam eden network promise (varsa).
//  • PRODUCTS_FETCH_TTL_MS = 5 dk — bu süre içinde memory cache varsa yeni
//    network fetch açılmaz; sadece state hidrasyonu yapılır.
//  • Concurrent caller'lar inflight promise'i paylaşır → tek Supabase
//    isteği yapılır, sonuç memoryHomeProducts'a yazılır, tüm caller'lar
//    setProducts ile state'lerini ondan hidrate eder.
//
// Davranış garantileri (DOKUNULMADI):
//  • HOME_FIELDS aynı.
//  • Product mapping (adaptLegacyProduct) aynı.
//  • sameProductListById guard aynı.
//  • fetchSupabaseProductById single-product cache aynı.
//  • product_status select aynı (network owner içinde inflight promise'in
//    parçası).
//  • SWR cache (AsyncStorage HOME_CACHE_KEY) aynı.
//  • Refetch (pull-to-refresh, useCache=false) TTL'yi BYPASS eder — her
//    zaman taze fetch yapar.
//  • Hook return API: { products, loading, error, refetch } aynı.
//
// Geri alma: lastProductsFetchAt + inflightProductsFetch + PRODUCTS_FETCH_TTL_MS
// sabitlerini ve fetchProducts içindeki "TTL skip" + "inflight share" + "owner
// finally" bloklarını kaldır.
let lastProductsFetchAt = 0;
let inflightProductsFetch: Promise<void> | null = null;
const PRODUCTS_FETCH_TTL_MS = 5 * 60 * 1000;

// PERF: cold-launch preload. Fire-and-forget IIFE that runs the moment this
// module is first evaluated (before any component mounts). On iOS AsyncStorage
// reads typically resolve in 5–20 ms, well before the navigation tree mounts
// the Home screen, so memoryHomeProducts is populated in time for Home's
// useState lazy initializer to seed render #1 with cached rows. If the race
// is lost (preload resolves after Home mounts), no harm done — the in-hook
// readHomeCache() inside fetchProducts() still hits the same data and the
// existing flow takes over. Guarded by `memoryHomeProducts == null` so we
// never clobber rows already loaded by an active hook instance.
// To rollback: delete this IIFE block.
(async () => {
  try {
    const cached = await readHomeCache();
    if (cached && cached.length > 0 && memoryHomeProducts == null) {
      memoryHomeProducts = cached;
    }
  } catch {
    /* preload best-effort */
  }
})();

/**
 * Python API'dan batch ürünleri çeker (Supabase'de olmayan ürünler için).
 * /api/v2/products/yeni endpoint'i — en son eklenen 50 ürünü döner.
 */
async function _fetchPythonBatchProducts(): Promise<Product[]> {
  if (!_API_BASE) return [];
  try {
    const res = await fetch(`${_API_BASE}/api/v2/products/yeni?limit=50`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const d = await res.json();
    const raw: unknown[] = d?.ürünler ?? d?.urunler ?? [];
    return raw.map((p) => adaptLegacyProduct(p as any) as unknown as Product);
  } catch {
    return [];
  }
}

export type SupabaseProduct = Product;

interface UseSupabaseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSupabaseProducts(): UseSupabaseProductsResult {
  // Lazy initializers seed initial state from the in-memory mirror so warm
  // remounts (tab switch, navigation back, RN screen reattach) start with
  // products already populated — no empty-skeleton flash. On true cold launch
  // memoryHomeProducts is null and we fall back to [] + loading=true exactly
  // as before.
  const [products, setProducts] = useState<Product[]>(() => memoryHomeProducts ?? []);
  const [loading, setLoading] = useState<boolean>(() => memoryHomeProducts == null);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async (opts?: { useCache?: boolean }): Promise<void> => {
    const useCache = opts?.useCache ?? true;
    const __fetchStart = perf.mark("supabase.fetchProducts.start");

    // SWR koruma — refresh path'inde (useCache=false) servedFromCache her
    // zaman false kalıyor; bu nedenle aşağıdaki üç "ekrandakini koru"
    // guard'ı dead durumdaydı ve transient bir hata ya da 0-satır yanıt
    // ürünleri []'e indiriyordu (4 Home section birden kaybolurdu).
    // Burada prev'in dolu olup olmadığını yakalıyoruz; cold-start
    // davranışı (prev boş) aynen korunur, yalnız warm-refresh wipe'ı
    // engellenir.
    let prevHadItems = false;
    setProducts((prev) => {
      prevHadItems = prev.length > 0;
      return prev;
    });

    // ── 1. Stale-while-revalidate: serve cache first if available ──────────
    // Skipped on explicit refetch (pull-to-refresh) so users get fresh data
    // instead of a brief stale flash before the network response lands.
    let servedFromCache = false;
    if (useCache) {
      const cached = await readHomeCache();
      if (cached && cached.length > 0) {
        // PERF — Home back flicker fix:
        // Önceden cache path her seferinde `setProducts(cached)` ile referansı
        // YENİLİYORDU. Warm remount'ta (Stack altta kalıyor olsa bile bazı
        // detach senaryolarında) bu, Home'da TÜM useMemo zincirini invalidate
        // edip FlatList data ref'ini değiştiriyor → kartlar key ile reuse
        // edilse de renderItem yeniden çağrılıyor, ProductCard plain function
        // (memo değil) re-render → kullanıcıda mikro flicker. Refresh path'te
        // zaten sameProductListById guard vardı; aynı guard'ı cache path'e de
        // ekleyerek aynı id+sıra cached payload'da products reference'ı
        // KORUNUR → useMemo'lar reuse, FlatList data aynı referans, sıfır
        // gereksiz rerender.
        // Geri alma: bu setProducts((prev) => ... ) bloğunu eski tek satıra
        // (`setProducts(cached)`) çevir.
        setProducts((prev) => {
          if (sameProductListById(prev, cached)) {
            memoryHomeProducts = prev;
            return prev;
          }
          memoryHomeProducts = cached;
          return cached;
        });
        setLoading(false);
        servedFromCache = true;
      }
    }

    // SAFE PERF PATCH 5 — TTL skip.
    // Memory mirror dolu ve son başarılı fetch 5 dk içindeyse network'e
    // hiç gitme: sadece state'i mirror'dan hidrate et. Pull-to-refresh
    // (useCache=false) bu bloğu atlar — kullanıcı manuel refresh isterse
    // her zaman taze fetch çalışır.
    if (
      useCache &&
      memoryHomeProducts &&
      memoryHomeProducts.length > 0 &&
      Date.now() - lastProductsFetchAt < PRODUCTS_FETCH_TTL_MS
    ) {
      setProducts((prev) =>
        sameProductListById(prev, memoryHomeProducts!) ? prev : memoryHomeProducts!,
      );
      setLoading(false);
      perf.measureSince("supabase.fetchProducts", __fetchStart);
      return;
    }

    // SAFE PERF PATCH 5 — Inflight share.
    // Başka bir hook instance'ı şu anda fetch ediyorsa, ikinci/üçüncü/...
    // çağrılar yeni Supabase isteği AÇMAZ; aynı promise'i bekler ve
    // tamamlanınca state'lerini memory mirror'dan hidrate eder.
    if (inflightProductsFetch) {
      try {
        await inflightProductsFetch;
      } catch {
        /* owner instance handles errors */
      }
      if (memoryHomeProducts && memoryHomeProducts.length > 0) {
        setProducts((prev) =>
          sameProductListById(prev, memoryHomeProducts!) ? prev : memoryHomeProducts!,
        );
      }
      setLoading(false);
      perf.measureSince("supabase.fetchProducts", __fetchStart);
      return;
    }

    if (!servedFromCache) {
      setLoading(true);
    }
    setError(null);

    // SAFE PERF PATCH 5 — Network owner. Bu instance gerçek fetch'i yapar;
    // inflightProductsFetch promise'i, paralel mount eden diğer hook'ların
    // beklemesi için register edilir. finally bloğunda timestamp güncellenir
    // ve inflight serbest bırakılır.
    let __resolveOwner: () => void = () => {};
    inflightProductsFetch = new Promise<void>((res) => {
      __resolveOwner = res;
    });

    try {
      // TEMPORARY: Supabase-only mode — Python API / batch / JSON kaynakları devre dışı.
      // Geri almak için: Promise.allSettled + _fetchPythonBatchProducts() + batchOnly merge ekle.
      perf.time("supabase.products.select");
      // ── Chunked pagination — PostgREST caps each response at 1000 rows ────
      // Loop in 1000-row pages until short response, scaling cleanly to 5k+
      // products and future pharmacy inventory imports.
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 50; // hard safety stop (= 50k products)
      const accumulated: any[] = [];
      let pageError: { message: string } | null = null;
      // PERF: Home/catalog payload trimmed from select("*") to the 15 fields
      // actually consumed by Home cards/bars. Drops wire size ~80–90% per row
      // (no ingredients, full_description, features, allergy_info, pregnancy_use,
      // breastfeeding_use, usage_instructions, analysis json, scores json,
      // barcode, etc.). Detail screen still uses fetchSupabaseProductById which
      // keeps select("*") for full row hydration. Search functions untouched.
      // To rollback: replace the explicit list below with "*".
      // (refactor v3) Rozet Karşılaştırması ilk render'da çalışsın diye
      // 4 hafif badge alanı eklendi: features (string[]) + 3 boolean.
      // Büyük metin alanları (ingredients/full_description/analysis/scores)
      // hâlâ dışarıda → wire size kazanımı korunuyor.
      // NOTE: `ingredients` Tip→Ürün eşleme (handleTipPress) için
      // gereklidir. INCI bileşen adlarını içeren tipler (retinol,
      // hyaluronic, ceramide, vb.) bu alan olmadan hiçbir ürünle
      // eşleşmez. Wire size ürün başına ~0.5–2 KB artırır; HOME_FIELDS
      // yine select("*")'ın çok altında kalır.
      // SCHEMA-ALIGN:
      //  • `contains_fragrance / contains_alcohol / contains_paraben`
      //    kolonları products tablosunda YOK → resolver
      //    (lib/featureBadges.ts → getFeatureFlag) features jsonb/array
      //    üzerinden türetir.
      //  • `active_ingredients` kolonu da products tablosunda YOK
      //    (PostgREST 42703 → tüm Home query'si fail → tüm section'lar
      //    gizleniyordu). Aşağı akış tüketicileri (searchEngine,
      //    treatmentFocus, dermoScore, productMatchEngine, vb.) zaten
      //    `?? []` veya Array.isArray ile null-safe — `ingredients`
      //    INCI listesi aynı aktifleri içerdiğinden kayıp yok.
      // ── Ecz4 PERF: `ingredients` AYRI bir Phase 2 background fetch'e
      //    taşındı (hydrateIngredientsBackground). İlk Home paint payload'ı
      //    ~30% küçülür (1254 row × ~400 char INCI metni → ~500KB tasarruf).
      //    Tip→ürün eşleme ve badges, hydration tamamlandığında (typically
      //    ilk paint sonrası ~600ms içinde) tam çalışır. Kullanıcı tip'e
      //    erken tıklarsa, name/brand/category/tags/badges tabanlı eşleme
      //    yine devreye girer (graceful degradation — push((p as any)?.ingredients)
      //    sadece undefined push eder, no crash).
      const HOME_FIELDS =
        "id,name,brand,category,subcategory,image_url,thumbnail_url,short_benefit,segment,rating,badges,tags,created_at,dermo_score,dermo_label,features";
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: pageData, error: pageErr } = await supabase
          .from("products")
          .select(HOME_FIELDS)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (pageErr) {
          pageError = pageErr;
          break;
        }
        if (!pageData || pageData.length === 0) break;
        accumulated.push(...pageData);
        if (pageData.length < PAGE_SIZE) break; // last page reached
      }
      const data = accumulated;
      const sbError = pageError;
      perf.timeEnd("supabase.products.select");
      perf.event("supabase.products.rows", { rows: data.length });

      if (sbError) {
        // Silenced: was console.error, which surfaced as a red LogBox banner
        // for transient/expected Postgres conditions (e.g. "canceling statement
        // due to statement timeout"). The SWR cache fallback below already
        // handles the user-visible side. Keep a dev-only warn so the message is
        // still discoverable in the dev console without blocking the UI.
        if (__DEV__) {
          console.warn("[Supabase] Ürün çekme hatası:", sbError.message);
        }
        // SWR: if cache is on screen, keep it visible — don't blank the UI.
        if (servedFromCache || prevHadItems) {
          if (__DEV__) {
            console.warn("[HomeCache] kept previous products after Supabase error");
          }
          return;
        }
        setError(sbError.message);
      }

      const supabaseProducts = data.map(
        adaptLegacyProduct,
      ) as unknown as Product[];
      if (__DEV__) {
        console.log(`[Supabase] ${supabaseProducts.length} ürün çekildi (paged, yalnızca Supabase modu).`);
      }

      // ── Moderasyon filtresi (Ecz4 Phase 2b: deferred) ─────────────────────
      // ÖNCEDEN: burada `await supabase.from("product_status").select(...)`
      // ile EK round-trip vardı (~100-200ms) ve Home first paint'i bloke
      // ediyordu. Tipik kullanımda product_status tablosu boş veya çok az
      // kayıt içeriyordu, dolayısıyla bu maliyet neredeyse hep boşa harcanıyordu.
      //
      // ŞİMDİ: tüm ürünler "approved by default" kabuliyle hemen render edilir;
      // hydrateProductStatusBackground (yukarıda tanımlı) ilk paint'in ardından
      // setTimeout(0) gecikmesiyle çalışır, pending/rejected satırları
      // subscriber Set broadcast'i ile prune eder. Davranış birebir aynı kalır
      // — sadece moderasyon filtresi ~300-500ms gecikmeli devreye girer.
      // Geri alma: bu satırı önceki try/catch bloğuyla değiştir + Phase 2b
      // global'leri ve `hydrateProductStatusBackground` fonksiyonunu sil.
      const visibleProducts = supabaseProducts;
      // ──────────────────────────────────────────────────────────────────────

      // SWR safety: if a successful fetch returns 0 rows AND we have cache on
      // screen, prefer cache. Catalog wipes are exceedingly rare; transient
      // empty-response edge cases (auth blip, RLS misconfig) are common.
      if (visibleProducts.length === 0 && (servedFromCache || prevHadItems)) {
        console.warn("[HomeCache] fresh fetch returned 0 rows; keeping previous products");
        return;
      }

      setProducts((prev) => {
        if (sameProductListById(prev, visibleProducts)) {
          memoryHomeProducts = prev;
          return prev;
        }
        memoryHomeProducts = visibleProducts;
        return visibleProducts;
      });

      // Fire-and-forget cache write — don't block UI on storage I/O.
      if (visibleProducts.length > 0) {
        void writeHomeCache(visibleProducts);
      }

      // Ecz4 PERF — Phase 2: ingredients background hydration.
      // İlk paint biter bitmez (microtask sonrası) ingredients kolonunu
      // ayrı bir lightweight query ile yükler ve subscriber Set üzerinden
      // tüm live useSupabaseProducts state'lerine broadcast eder. Tip→ürün
      // eşleme ve badges hidrate olduktan sonra tam çalışır. Singleflight
      // + TTL guard module-level (yukarıda tanımlı).
      if (visibleProducts.length > 0) {
        void hydrateIngredientsBackground();
        // Ecz4 PERF — Phase 2b: product_status moderasyon filtresi background'a
        // taşındı; ilk paint bloklamaz, prune işlemi setTimeout(0) sonrası
        // subscriber Set broadcast ile uygulanır. Singleflight + 5dk TTL.
        void hydrateProductStatusBackground();
        // Ecz4 PERF — Phase 2a: short_description HOME_FIELDS'tan çıkarıldı
        // (~250-500 KB tasarruf). Background hidrasyon ProductCard fallback
        // satırını ~500-800ms sonra besler; öncesinde short_benefit gösterilir.
        void hydrateShortDescriptionBackground();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      // Demoted error → warn for mobile DEV LogBox quiet behavior. The SWR
      // fallback below preserves user-visible state on transient network
      // failures (TypeError: Network request failed). setError still fires
      // for cold-launch (no cache) so the UI can surface a real error state.
      if (__DEV__) {
        console.warn("[Supabase] Beklenmeyen hata (recoverable):", msg);
      }
      // SWR: if cache is on screen, keep it visible — don't blank the UI.
      if (servedFromCache || prevHadItems) {
        if (__DEV__) {
          console.warn("[HomeCache] kept previous products after unexpected error");
        }
        return;
      }
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
      perf.measureSince("supabase.fetchProducts", __fetchStart);
      // SAFE PERF PATCH 5 — Network owner cleanup. Timestamp'i güncelle
      // (TTL hesabı buradan başlar) ve bekleyen concurrent caller'ları
      // serbest bırak. Hata olsa bile inflight slot'unu boşalt — yoksa
      // sonraki fetch denemeleri inflight'a takılı kalır.
      lastProductsFetchAt = Date.now();
      __resolveOwner();
      inflightProductsFetch = null;
    }
  };

  useEffect(() => {
    // Ecz4 PERF: subscribe to ingredients hydration broadcasts so a Phase 2
    // merge dispatched by another instance can update this instance's state
    // (e.g. Home opens, hydration runs, user navigates to detail+back; new
    // Home mount's setter joins the subscriber Set in time for re-broadcast).
    productsSubscribers.add(setProducts);
    fetchProducts();
    return () => {
      // Unmount: stop receiving broadcasts. Prevents stale setState calls.
      productsSubscribers.delete(setProducts);
    };
  }, []);

  return { products, loading, error, refetch: () => fetchProducts({ useCache: false }) };
}

/**
 * Brand alias map — used to translate fuzzy/partial brand mentions
 * ("la roche", "lrp", "avene") to the canonical brand value stored in Supabase.
 * Keep aliases lowercase; matching is case-insensitive and tolerant of accents.
 */
const BRAND_ALIAS_MAP: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: "La Roche-Posay",
    aliases: ["laroche", "la roche", "la roche posay", "roche posay", "roche", "lrp", "la-roche", "la-roche-posay"],
  },
  { canonical: "Avène", aliases: ["avene", "avène", "aven"] },
  { canonical: "Bioderma", aliases: ["bioderma", "bideorma", "bioderm"] },
  { canonical: "Ducray", aliases: ["ducray", "ducre", "ducrey"] },
  { canonical: "CeraVe", aliases: ["cerave", "cera ve", "cerrave"] },
  { canonical: "Vichy", aliases: ["vichy", "vichi", "vici"] },
  { canonical: "Eucerin", aliases: ["eucerin", "eucerine", "eucern"] },
  { canonical: "Bioxcin", aliases: ["bioxcin", "bioxsin", "biocsin"] },
  { canonical: "Mustela", aliases: ["mustela", "mustella"] },
  { canonical: "Neutrogena", aliases: ["neutrogena", "neutrog", "neutrogina"] },
  // L'Oréal Paris — accent + apostrophe means PostgREST ilike can't find it
  // when user types plain ASCII "loreal". Resolving via alias adds an exact
  // brand.eq lookup that works regardless of accent normalization.
  { canonical: "L'Oréal Paris", aliases: ["loreal", "l'oreal", "l'oréal", "loreal paris", "loreal-paris", "loréal", "lorel"] },
];

function normalizeForAlias(s: string): string {
  return s
    .toLowerCase()
    .replace(/é|è|ê|ë/g, "e")
    .replace(/à|á|â|ä/g, "a")
    .replace(/ı|î|ï/g, "i")
    .replace(/ö|ô/g, "o")
    .replace(/ü|û/g, "u")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .trim();
}

function resolveBrandFromQuery(q: string): string | null {
  const norm = normalizeForAlias(q);
  for (const { canonical, aliases } of BRAND_ALIAS_MAP) {
    if (normalizeForAlias(canonical) === norm) return canonical;
    if (aliases.some((a) => normalizeForAlias(a) === norm)) return canonical;
    // Loose contains: query "la roche posay duo" still resolves to LRP
    if (aliases.some((a) => norm.includes(normalizeForAlias(a)) && a.length >= 4)) return canonical;
  }
  return null;
}

export const INITIAL_RESULT_LIMIT = 50;
// Hard cap when "Tümünü Gör" is pressed. Single search is bounded by Supabase's
// 1000-row max-cap which is safe for any current-catalog brand search.
const LOAD_ALL_LIMIT = 1000;

export type SearchSupabaseResult = {
  results: Product[];
  hasMore: boolean;
};

/**
 * Mobile remote search — directly queries Supabase across all relevant fields.
 *   - Fields: name, brand, category, subcategory, short_description, short_benefit, barcode
 *   - Brand alias expansion (LRP, Avène, etc.)
 *   - Case-insensitive (ilike) and accent-tolerant via alias map
 *   - Pagination strategy:
 *       page = 0  → fetch INITIAL_RESULT_LIMIT+1 (51) rows; return first 50 + hasMore
 *       page > 0  → fetch up to LOAD_ALL_LIMIT (1000) rows; return all + hasMore=false
 *   - Ordered by relevance:
 *       1. Brand alias canonical match (e.g. typing "la roche" → all LRP first)
 *       2. Exact brand/name equality
 *       3. Brand/name startsWith
 *       4. Field contains
 */
export async function searchSupabaseProducts(
  query: string,
  page: number = 0,
): Promise<SearchSupabaseResult> {
  if (!query.trim()) return { results: [], hasMore: false };
  try {
    const q = query.trim();
    // Strip characters that break PostgREST .or() list parsing
    const safe = q.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    const resolvedBrand = resolveBrandFromQuery(safe);

    // Build the set of "brand tokens" to subtract from the query when computing
    // residual relevance signals. If brand was resolved (e.g. "Ducray kera" →
    // "Ducray"), the user's intent for the rest of the query ("kera") must
    // boost name matches like "Keracnyl" — otherwise every Ducray product
    // ties at the brand-base score and falls back to alphabetical order,
    // burying the actual product the user typed.
    const brandAliases = new Set<string>();
    if (resolvedBrand) {
      const entry = BRAND_ALIAS_MAP.find((b) => b.canonical === resolvedBrand);
      if (entry) {
        // Tokenize canonical name + every alias and add each token.
        // Example for "La Roche-Posay" → {la, roche, posay, lrp, ...}
        const toTokens = (s: string) =>
          normalizeForAlias(s).split(/[\s\-]+/).filter((t) => t.length > 0);
        for (const tok of toTokens(entry.canonical)) brandAliases.add(tok);
        for (const a of entry.aliases) {
          for (const tok of toTokens(a)) brandAliases.add(tok);
        }
      }
    }
    const residualTokens = resolvedBrand
      ? normalizeForAlias(safe)
          .split(/\s+/)
          .filter((t) => t.length >= 2 && !brandAliases.has(t))
      : [];

    const orParts: string[] = [
      `name.ilike.%${safe}%`,
      `brand.ilike.%${safe}%`,
      `category.ilike.%${safe}%`,
      `subcategory.ilike.%${safe}%`,
      `short_description.ilike.%${safe}%`,
      `short_benefit.ilike.%${safe}%`,
      `barcode.ilike.%${safe}%`,
    ];
    if (resolvedBrand) {
      // Wrap canonical in double quotes — PostgREST requires this for values
      // containing spaces, hyphens, or other separators ("La Roche-Posay").
      orParts.push(`brand.eq."${resolvedBrand}"`);
    }

    // page=0 → fetch INITIAL_RESULT_LIMIT+1 rows (51) via .limit() to detect
    //          "there is more" without paying for the rest.
    // page>0 → fetch ONLY the remaining window via .range(50, 1049). Range is
    //          inclusive on both ends, so this requests rows [50..1049] = up to
    //          1000 items AFTER the first 50. The 1-row overlap at index 50 is
    //          intentional safety net: page 0 may have dropped the 51st-by-score
    //          row from its 51-row window, and the caller's dedupe-by-id guard
    //          cleans up the overlap. Net result: zero gaps, zero duplicates.
    // Deterministic server-side ordering by name is REQUIRED for gap-free
    // remaining-only pagination. Without it, page 0's client-side score sort
    // (which uses alphabetical name as the tie-breaker) would drop a row at
    // an unpredictable DB position, and page 1's range(50, 1049) would miss
    // it. With name-order on the server, the row dropped by page 0 is exactly
    // alpha-index 50 — which page 1 re-fetches as its first row and dedupe
    // collapses the 1-row overlap. Net: zero gaps, zero duplicates.
    let req = supabase
      .from("products")
      .select("*")
      .or(orParts.join(","))
      .order("name", { ascending: true, nullsFirst: false });
    if (page === 0) {
      req = req.limit(INITIAL_RESULT_LIMIT + 1);
    } else {
      req = req.range(INITIAL_RESULT_LIMIT, INITIAL_RESULT_LIMIT + LOAD_ALL_LIMIT - 1);
    }
    const { data, error } = await req;

    if (error) {
      console.error("[Supabase] Arama hatası:", error.message);
      return { results: [], hasMore: false };
    }

    const rows = (data ?? []) as any[];
    const qLower = safe.toLowerCase();

    // Client-side relevance scoring (Postgres can't easily order by these tiers)
    function score(p: any): number {
      const name = String(p.name ?? "").toLowerCase();
      const brand = String(p.brand ?? "").toLowerCase();
      const nameNorm = normalizeForAlias(name);

      // Base tier: brand canonical / equality / startsWith / contains
      let s: number;
      if (resolvedBrand && p.brand === resolvedBrand) {
        // Brand match → base 100, but DO NOT early-return: we still want to
        // boost rows whose name matches the residual (non-brand) tokens so
        // "Ducray kera" surfaces "Keracnyl …" above "Anacaps", "Anaphase" etc.
        s = 100;
      } else if (name === qLower || brand === qLower) {
        s = 90;
      } else if (name.startsWith(qLower) || brand.startsWith(qLower)) {
        s = 80;
      } else if (name.includes(qLower) || brand.includes(qLower)) {
        s = 60;
      } else {
        // Tier 4: contains in any of the longer-text fields
        s = 30;
      }

      // Residual-token boost: only when brand was resolved AND there is a
      // non-brand portion of the query left. Adds a small relevance kicker
      // proportional to how strongly the name aligns with the residual.
      if (residualTokens.length > 0) {
        for (const tok of residualTokens) {
          if (nameNorm.startsWith(tok)) {
            s += 40;
          } else if (new RegExp(`\\b${tok}`).test(nameNorm)) {
            s += 25;
          } else if (nameNorm.includes(tok)) {
            s += 15;
          }
        }
      }

      return s;
    }

    rows.sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sb - sa;
      // Tie-breaker: alphabetical name
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    // ── STRICT RESIDUAL FILTER ──────────────────────────────────────────
    // Bug: "bioderma node" → resolvedBrand="Bioderma", residualTokens=["node"].
    // OR query brings ALL Bioderma rows; scoring only BOOSTS rows containing
    // "node" but does not REMOVE the rest, so the top 50 fills with arbitrary
    // Bioderma items that have nothing to do with the user's intent.
    //
    // Fix: when a brand is resolved AND the user typed extra tokens, those
    // tokens MUST be present (case/diacritic-insensitive) in at least one of
    // name / subcategory / category. No score-based escape hatch — this is a
    // filter, not a ranking concern. Residual-empty queries (e.g. plain
    // "bioderma") are unaffected.
    let filtered: any[];
    if (resolvedBrand && residualTokens.length > 0) {
      filtered = rows.filter((p) => {
        // Brand-locked: drop rows whose brand isn't the resolved one.
        // (Cross-brand text matches from the OR query are out of scope here.)
        if (p.brand !== resolvedBrand) return false;
        const hay = normalizeForAlias(
          [p.name, p.subcategory, p.category].filter(Boolean).join(" "),
        );
        // Every residual token must appear in the haystack.
        return residualTokens.every((tok) => hay.includes(tok));
      });
    } else {
      filtered = rows;
    }

    let results: Product[];
    let hasMore: boolean;
    if (page === 0) {
      results = filtered.slice(0, INITIAL_RESULT_LIMIT) as Product[];
      hasMore = filtered.length > INITIAL_RESULT_LIMIT;
    } else {
      results = filtered as Product[];
      hasMore = false;
    }

    if (__DEV__) {
      console.log(
        `[searchSupabase] q="${q}" page=${page} → ${results.length}/${rows.length} (filtered=${filtered.length}) hasMore=${hasMore} (resolvedBrand=${resolvedBrand ?? "none"})`,
      );
      console.log("[search residual]", residualTokens);
    }
    return { results, hasMore };
  } catch (err) {
    console.error("[Supabase] Arama hatası:", err);
    return { results: [], hasMore: false };
  }
}

/**
 * Supabase products tablosunda kategori listesine göre ürün filtreler.
 * Endişe bazlı arama için kullanılır — metin araması yerine kategori eşleşmesi.
 */
export async function searchSupabaseProductsByCategories(
  categories: string[],
  limit = 200,
): Promise<Product[]> {
  if (!categories.length) return [];
  try {
    const orFilter = categories
      .map((cat) => `category.ilike.%${cat}%`)
      .join(",");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(orFilter)
      .order("name", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("[Supabase] Kategori arama hatası:", error.message);
      return [];
    }
    return (data ?? []) as Product[];
  } catch (err) {
    console.error("[Supabase] Kategori arama hatası:", err);
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Compare candidate pool fetcher ────────────────────────────────────────
// PostgREST defaults a single response to 1000 rows. The Home loader already
// pages through everything in 1000-row chunks, but warm cache hydration and
// transient slow refreshes can leave the in-memory list at 1000 when the
// compare screen mounts. The compare candidate pool MUST be complete so a
// product whose category/subcategory siblings live past row 1000 still gets
// candidates. This helper fetches the minimal compare-relevant fields
// (≈ 13 cols) scoped by category + subcategory in 1000-row pages, with a
// hard safety stop. In-memory cached per `category|subcategory` for the
// session — compare does not need real-time freshness.
//
// Fields kept intentionally minimal to stay under HTTP wire budget while
// still satisfying findComparisonCandidates / pairKey / treatment-focus /
// rank inputs (id, name, brand, barcode, image_url, thumbnail_url,
// category, subcategory, short_description, short_benefit, rating, segment,
// features, badges).
// NOTE: Schema-aligned. `contains_*` columns do not exist in the products
// table (Supabase PostgREST returns 42703 for unknown columns and the entire
// query fails). Any "contains fragrance / alcohol / paraben / sulfate /
// silicone" flags must be derived downstream from the existing `features`
// JSON / `tags` / `badges` fields, not from dedicated columns.
const COMPARE_FIELDS =
  "id,name,brand,barcode,category,subcategory,storage_image_url,storage_image_path,source_image_url,image_url,thumbnail_url,short_benefit,short_description,segment,rating,features,badges,tags,dermo_score,dermo_label";
const compareCandidatesCache = new Map<string, Product[]>();
const compareCandidatesInflight = new Map<string, Promise<Product[]>>();

// ── DEV-only diagnostics ─────────────────────────────────────────────────
// Populated inside fetchSupabaseCompareCandidates so the mukayese-adayi
// debug panel can surface why a fetch returned 0 without relying on
// Metro/Expo console scrollback. Production builds never read this map.
export type CompareFetchDiagnostics = {
  healthCount: number | null;
  healthError: { message: string; code: string | null } | null;
  healthSampleLength: number | null;
  sampleCount: number | null;
  sampleError: { message: string; code: string | null } | null;
  queryResultCount: number | null;
  queryError: { message: string; code: string | null } | null;
  usedCategoryFilter: boolean | null;
  selectedFields: string;
  normCat: string;
  normSub: string;
  ranAt: number;
};
const compareCandidatesDiagnostics = new Map<string, CompareFetchDiagnostics>();
export function getCompareFetchDiagnostics(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): CompareFetchDiagnostics | null {
  if (!__DEV__) return null;
  return compareCandidatesDiagnostics.get(_compareCacheKey(category, subcategory)) ?? null;
}
function _normErr(e: any): { message: string; code: string | null } | null {
  if (!e) return null;
  return {
    message: typeof e.message === "string" ? e.message : String(e),
    code: (e && (e.code ?? e.status)) != null ? String(e.code ?? e.status) : null,
  };
}

// Türkçe karakterleri ASCII'ye indirger; trim + lowercase. Casing/aksan
// uyumsuzluklarını gidermek için ilike pattern'inde kullanılır.
function _normTr(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s");
}

function _compareCacheKey(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): string {
  return `${_normTr(category)}|${_normTr(subcategory)}`;
}

/**
 * Supabase'den verilen kategori (+opsiyonel alt kategori) için compare
 * havuzunu sayfalı (1000'er) çeker, MAX 50 sayfa (=50k ürün) güvenlik
 * limiti. ilike + %normalized% pattern → casing toleransı. Subcategory
 * 0 sonuç verirse yalnız category ile tekrar denenir. Sonuç
 * adaptLegacyProduct'tan geçirilir, oturum içi cache'lenir.
 */
export async function fetchSupabaseCompareCandidates(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): Promise<Product[]> {
  if (!category || !category.trim()) return [];
  const normCat = _normTr(category);
  const normSub = _normTr(subcategory);
  const key = _compareCacheKey(category, subcategory);

  const cached = compareCandidatesCache.get(key);
  if (cached) return cached;

  const inflight = compareCandidatesInflight.get(key);
  if (inflight) return inflight;

  // DEV-only diagnostic accumulator surfaced via getCompareFetchDiagnostics.
  // Production (__DEV__ === false) skips all writes.
  const diag: CompareFetchDiagnostics | null = __DEV__
    ? {
        healthCount: null,
        healthError: null,
        healthSampleLength: null,
        sampleCount: null,
        sampleError: null,
        queryResultCount: null,
        queryError: null,
        usedCategoryFilter: null,
        selectedFields: COMPARE_FIELDS,
        normCat,
        normSub,
        ranAt: Date.now(),
      }
    : null;

  const promise = (async () => {
    // ── DEV-only Supabase health probe (no behavior change) ──────────────
    // Verifies table reachability + row count + sample id shape BEFORE the
    // real paginated fetch so we can pinpoint whether 0-result issues come
    // from the query, the connection, or RLS.
    if (__DEV__ && diag) {
      try {
        const health = await supabase
          .from("products")
          .select("id", { count: "exact" })
          .limit(1);
        diag.healthCount = health.count ?? null;
        diag.healthError = _normErr(health.error);
        diag.healthSampleLength = Array.isArray(health.data) ? health.data.length : null;
      } catch (e) {
        diag.healthError = _normErr(e);
      }
      try {
        const sample = await supabase
          .from("products")
          .select("id")
          .limit(10);
        diag.sampleCount = Array.isArray(sample.data) ? sample.data.length : 0;
        diag.sampleError = _normErr(sample.error);
      } catch (e) {
        diag.sampleError = _normErr(e);
      }
      compareCandidatesDiagnostics.set(key, diag);
    }

    const PAGE_SIZE = 1000;
    const MAX_PAGES = 50;

    // Soft category filter — used as a hint only. NEVER blocks results:
    // if 0 rows come back with the filter on, we re-fetch without it so the
    // pool is never empty when the database has products. Subcategory is
    // intentionally NOT used as a Supabase filter; downstream JS logic
    // (findComparisonCandidates / arePairsCompatible / pairKey) does the
    // real compatibility filtering with full fidelity.
    const runQuery = async (useCategoryFilter: boolean): Promise<any[]> => {
      const acc: any[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        let req = supabase
          .from("products")
          .select(COMPARE_FIELDS);
        if (useCategoryFilter && normCat) {
          req = req.ilike("category", `%${normCat}%`);
        }
        const { data, error } = await req
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) {
          if (__DEV__ && diag) {
            diag.queryError = _normErr(error);
            compareCandidatesDiagnostics.set(key, diag);
            console.warn(
              "[Supabase] compare candidate fetch error (page",
              page,
              "useCategoryFilter=",
              useCategoryFilter,
              "):",
              error.message,
            );
          }
          break;
        }
        if (!data || data.length === 0) break;
        acc.push(...data);
        if (data.length < PAGE_SIZE) break;
      }
      return acc;
    };

    try {
      // 1) Soft attempt with category hint (cheaper wire if it works).
      let rows = await runQuery(true);
      let usedCategoryFilter = true;
      // 2) Guaranteed fallback — broad fetch, no filters. Downstream JS
      //    pairKey/findComparisonCandidates/arePairsCompatible narrow it.
      if (rows.length === 0) {
        usedCategoryFilter = false;
        rows = await runQuery(false);
      }
      if (__DEV__ && diag) {
        diag.queryResultCount = rows.length;
        diag.usedCategoryFilter = usedCategoryFilter;
        compareCandidatesDiagnostics.set(key, diag);
      }
      const products = rows.map(
        adaptLegacyProduct,
      ) as unknown as Product[];
      compareCandidatesCache.set(key, products);
      return products;
    } catch (err) {
      if (__DEV__) {
        console.warn("[Supabase] compare candidate fetch failed:", err);
      }
      return [];
    } finally {
      compareCandidatesInflight.delete(key);
    }
  })();
  compareCandidatesInflight.set(key, promise);
  return promise;
}

// PERF: Modül seviyesi tek-uçuş (single-flight) önbelleği.
// Mukayese detayını ileri/geri navigasyonlarında aynı id'leri tekrar tekrar
// fetch ediyorduk; bu hem ağ trafiği hem hidrasyon gecikmesi yaratıyordu.
//
// Kapsam:
//   - `productByIdCache`     → tamamlanmış sonuçlar (hit ise anında döner)
//   - `productByIdInflight`  → uçuştaki Promise (paralel çağrılar tek isteği paylaşır)
//
// Geçersiz kılma yok: oturum içi cache yeterli; ürün verisi sık değişmez ve
// Home liste yenilemesi (refetch) tam ürünleri etkilemez. Hata durumunda
// sonucu cache'lemiyoruz — bir sonraki çağrıda yeniden denenir.
const productByIdCache = new Map<string, Product>();
const productByIdInflight = new Map<string, Promise<Product | null>>();

/**
 * Supabase'den tek bir ürünü id ile çeker. In-memory cache kullanır;
 * aynı id için tekrar çağrı varsa ağa çıkmaz.
 */
export async function fetchSupabaseProductById(
  id: string,
): Promise<Product | null> {
  if (!id || !UUID_RE.test(id)) return null;

  const cached = productByIdCache.get(id);
  if (cached) return cached;

  const inflight = productByIdInflight.get(id);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        // Recoverable: caller (product detail) already handles null by
        // showing a fallback / retry UI. Demoted from error → warn so mobile
        // DEV LogBox does NOT show a red overlay on transient network blips.
        if (__DEV__) {
          console.warn("[Supabase] Ürün yükleme hatası (recoverable):", error.message);
        }
        return null;
      }
      const product = data as Product | null;
      if (product) productByIdCache.set(id, product);
      return product;
    } catch {
      return null;
    } finally {
      productByIdInflight.delete(id);
    }
  })();
  productByIdInflight.set(id, promise);
  return promise;
}
