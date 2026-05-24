import React from "react";
import { View, Text } from "react-native";
import {
  localProducts,
  localArticles,
  localRoutines,
  localComparisons,
  localProfile,
  getTableData,
} from "./original_local_dataset_v76";

export const V74_SAFE_SHIM = true;
export const V75G_CLEAN_SHIM = true;
export const V76D_ORIGINAL_LOCAL_DATA_ADAPTER = true;

const emptyResult = { data: null, error: null };
const emptyArrayResult = { data: [], error: null };

function cloneRows(rows: any[]) {
  return JSON.parse(JSON.stringify(rows || []));
}

function applyEq(rows: any[], key: string, value: any) {
  return rows.filter((row) => String(row?.[key]) === String(value));
}

function applyIlike(rows: any[], key: string, value: any) {
  const q = String(value || "").replace(/%/g, "").toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => String(row?.[key] ?? "").toLowerCase().includes(q));
}

function createQuery(tableName: string, seedRows?: any[]) {
  let rows = cloneRows(seedRows || getTableData(tableName));
  let singleMode = false;
  let maybeSingleMode = false;

  const query: any = {
    select: () => query,
    insert: (payload?: any) => {
      const inserted = Array.isArray(payload) ? payload : payload ? [payload] : [];
      rows = inserted.length ? inserted : rows;
      return query;
    },
    update: () => query,
    delete: () => {
      rows = [];
      return query;
    },
    upsert: (payload?: any) => {
      const inserted = Array.isArray(payload) ? payload : payload ? [payload] : [];
      rows = inserted.length ? inserted : rows;
      return query;
    },
    eq: (key: string, value: any) => {
      rows = applyEq(rows, key, value);
      return query;
    },
    neq: (key: string, value: any) => {
      rows = rows.filter((row) => String(row?.[key]) !== String(value));
      return query;
    },
    ilike: (key: string, value: any) => {
      rows = applyIlike(rows, key, value);
      return query;
    },
    like: (key: string, value: any) => {
      rows = applyIlike(rows, key, value);
      return query;
    },
    in: (key: string, values: any[]) => {
      const set = new Set((values || []).map((v) => String(v)));
      rows = rows.filter((row) => set.has(String(row?.[key])));
      return query;
    },
    order: (key: string, opts?: any) => {
      const asc = opts?.ascending !== false;
      rows = [...rows].sort((a, b) => {
        const av = a?.[key];
        const bv = b?.[key];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (asc ? 1 : -1);
      });
      return query;
    },
    limit: (n: number) => {
      rows = rows.slice(0, Number(n) || rows.length);
      return query;
    },
    range: (from: number, to: number) => {
      rows = rows.slice(Number(from) || 0, (Number(to) || 0) + 1);
      return query;
    },
    single: () => {
      singleMode = true;
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    maybeSingle: () => {
      maybeSingleMode = true;
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    then: (resolve: any, reject: any) => {
      const payload = singleMode || maybeSingleMode
        ? { data: rows[0] || null, error: null }
        : { data: rows, error: null };
      return Promise.resolve(payload).then(resolve, reject);
    },
    catch: () => Promise.resolve({ data: rows, error: null }),
  };

  return query;
}

const emptySubscription = { data: { subscription: { unsubscribe: () => null } } };

export const supabase: any = {
  from: (tableName: string) => createQuery(tableName),
  storage: {
    from: () => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: path || "" } }),
      upload: async () => emptyResult,
      download: async () => emptyResult,
      remove: async () => emptyResult,
      list: async () => ({ data: [], error: null }),
    }),
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => emptyResult,
    signUp: async () => emptyResult,
    signOut: async () => emptyResult,
    onAuthStateChange: () => emptySubscription,
  },
};

export default supabase;

export const useAuth = () => ({
  user: null,
  session: null,
  profile: localProfile,
  loading: false,
  isPremium: false,
  effectiveRole: "user",
  signIn: async () => emptyResult,
  signOut: async () => emptyResult,
  signUp: async () => emptyResult,
});

export const useUser = () => ({ user: null, profile: localProfile, loading: false });
export const useProfile = () => ({ profile: localProfile, loading: false });
export const usePremium = () => ({ isPremium: false, loading: false });
export const useSession = () => ({ session: null, loading: false });

export const AuthProvider = ({ children }: any) => <>{children}</>;
export const SessionProvider = ({ children }: any) => <>{children}</>;
export const SupabaseProvider = ({ children }: any) => <>{children}</>;
export const UserProvider = ({ children }: any) => <>{children}</>;
export const PremiumProvider = ({ children }: any) => <>{children}</>;

export const Camera = (props: any) => (
  <View {...props}>
    <Text>Kamera sonraki aşamada bağlanacak.</Text>
  </View>
);
export const CameraView = Camera;
export const useCameraPermissions = () => [{ granted: false }, async () => ({ granted: false })];
export const requestCameraPermissionsAsync = async () => ({ granted: false });

export const ImagePicker = {};
export const launchImageLibraryAsync = async () => ({ canceled: true, assets: [] });
export const launchCameraAsync = async () => ({ canceled: true, assets: [] });
export const MediaTypeOptions = { Images: "Images" };

export const AsyncStorage: any = {
  getItem: async () => null,
  setItem: async () => null,
  removeItem: async () => null,
  clear: async () => null,
};

export const getPublicUrl = (path: string) => path || "";
export const uploadImage = async () => ({ url: "", error: null });
export const fetchProducts = async () => localProducts;
export const fetchProductById = async (id: string) => localProducts.find((p: any) => String(p.id) === String(id)) || localProducts[0] || null;
export const fetchRoutine = async () => localRoutines[0] || null;
export const saveRoutine = async () => ({ ok: true });
export const saveFavorite = async () => ({ ok: true });
export const removeFavorite = async () => ({ ok: true });
export const safeNoop = async () => emptyResult;
export const safeArray = async () => emptyArrayResult;

export const safeGeneric: any = new Proxy(function () {}, {
  get: () => safeGeneric,
  apply: () => emptyResult,
});

export const ARTICLE_TRUST_LABEL: any = safeGeneric;
export const INITIAL_RESULT_LIMIT: any = safeGeneric;
export const NASIL_DEGERLENDIRIYORUZ: any = safeGeneric;
export const PC: any = safeGeneric;
export const PREMIUM_FEATURES: any = safeGeneric;
export const PremiumLockCard: any = safeGeneric;
export const PremiumTeaserBlock: any = safeGeneric;
export const SECKIN_BLOCK_FEATURES: any = safeGeneric;
export const analyzePhotoBrightness: any = safeGeneric;
export const analyzePhotoFull: any = safeGeneric;
export const analyzePhotosBrightness: any = safeGeneric;
export const buildRoutineFromAnalysis: any = safeGeneric;
export const canAccessFeature: any = safeGeneric;
export const captureStore: any = safeGeneric;
export const clearAllOnLogout: any = safeGeneric;
export const computePerceptualHash: any = safeGeneric;
export const fetchSupabaseProductById: any = safeGeneric;
export const getPremiumHeroColors: any = safeGeneric;
export const hammingDistanceHex: any = safeGeneric;
export const historyStore: any = safeGeneric;
export const persistResult: any = safeGeneric;
export const pickImage: any = safeGeneric;
export const resolveAbsoluteUri: any = safeGeneric;
export const resolveStep: any = safeGeneric;
export const resultStore: any = safeGeneric;
export const routineProgramStore: any = safeGeneric;
export const searchSupabaseProducts: any = safeGeneric;
export const searchSupabaseProductsByCategories: any = safeGeneric;
export const toSupabaseThumbnail: any = safeGeneric;
export const unwrapProxyImg: any = safeGeneric;
export const useAuthGate: any = safeGeneric;
export const usePremiumFlow: any = safeGeneric;
export const useSupabaseProducts: any = safeGeneric;
