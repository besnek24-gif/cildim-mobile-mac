/**
 * useFavorites — Supabase tabanlı favoriler hook'u
 *
 * Kullanım:
 *   const { isFavorite, toggle, refresh } = useFavorites();
 *   const fav = isFavorite(product.id); // boolean
 *   await toggle(product.id);           // ekle / çıkar (optimistic UI)
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getFavoriteIds, toggleFavoriteSupabase } from "@/lib/favoritesService";

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setFavoriteIds([]);
      return;
    }
    setLoadingFavs(true);
    const ids = await getFavoriteIds(user.id);
    setFavoriteIds(ids);
    setLoadingFavs(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.includes(String(productId)),
    [favoriteIds],
  );

  const toggle = useCallback(
    async (productId: string): Promise<void> => {
      if (!user?.id) return;

      const pid = String(productId);
      const wasIn = favoriteIds.includes(pid);

      setFavoriteIds(prev =>
        wasIn ? prev.filter(id => id !== pid) : [...prev, pid],
      );

      try {
        await toggleFavoriteSupabase(user.id, pid);
      } catch {
        setFavoriteIds(prev =>
          wasIn ? [...prev, pid] : prev.filter(id => id !== pid),
        );
      }
    },
    [user?.id, favoriteIds],
  );

  return { favoriteIds, isFavorite, toggle, refresh: load, loadingFavs };
}
