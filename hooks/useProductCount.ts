import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabaseClient";
import perf from "@/src/utils/performanceLogger";

const STORAGE_KEY = "cildim:productCount:lastKnown";

let memoryCache: number | null = null;
let inflight: Promise<number | null> | null = null;

async function fetchCount(): Promise<number | null> {
  const __start = perf.mark("supabase.productCount.start");
  try {
    const { count, error } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    perf.measureSince("supabase.productCount", __start);
    if (error || count == null) return null;
    perf.event("supabase.productCount.value", { count });
    return count;
  } catch {
    perf.measureSince("supabase.productCount.error", __start);
    return null;
  }
}

export interface UseProductCountResult {
  count: number | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useProductCount(): UseProductCountResult {
  const [count, setCount] = useState<number | null>(memoryCache);
  const [loading, setLoading] = useState<boolean>(memoryCache == null);

  const load = async (active: { current: boolean }) => {
    if (memoryCache == null) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const cached = raw != null ? Number(raw) : NaN;
        if (active.current && Number.isFinite(cached) && cached > 0) {
          memoryCache = cached;
          setCount(cached);
        }
      } catch {
      }
    }

    if (!inflight) inflight = fetchCount();
    const fresh = await inflight;
    inflight = null;

    if (!active.current) return;
    if (fresh != null) {
      memoryCache = fresh;
      setCount(fresh);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, String(fresh));
      } catch {
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const active = { current: true };
    void load(active);
    return () => {
      active.current = false;
    };
  }, []);

  const refetch = async () => {
    inflight = fetchCount();
    const fresh = await inflight;
    inflight = null;
    if (fresh != null) {
      memoryCache = fresh;
      setCount(fresh);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, String(fresh));
      } catch {
      }
    }
  };

  return { count, loading, refetch };
}
