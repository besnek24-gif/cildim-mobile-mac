import { useEffect, useState } from "react";
import {
  getUserEvents,
  computeLearningProfile,
  type LearningProfile,
} from "@/lib/userEvents";

/**
 * Kullanıcının geçmiş etkileşimlerinden öğrenme profili oluşturur.
 * Asenkron yüklenir; yeterli veri yoksa null döner.
 * products listesi yüklendiğinde bir kez çalışır, performansı etkilemez.
 */
export function useLearningProfile(
  products: Array<{ id: string | number; category?: string; subcategory?: string }>,
): LearningProfile | undefined {
  const [profile, setProfile] = useState<LearningProfile | undefined>(undefined);

  useEffect(() => {
    if (products.length === 0) return;
    getUserEvents()
      .then((events) => setProfile(computeLearningProfile(events, products)))
      .catch(() => {});
  }, [products.length]);

  return profile;
}
