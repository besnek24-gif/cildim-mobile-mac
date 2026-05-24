import { useEffect, useState } from "react";
import {
  getUserEvents,
  computeConcernInterestProfile,
  type ConcernInterestProfile,
} from "@/lib/userEvents";

/**
 * Kullanıcının event geçmişinden concern ilgi profili oluşturur.
 * Asenkron yüklenir; yeterli veri yoksa hasEnoughData = false.
 */
export function useConcernInterestProfile(): ConcernInterestProfile {
  const empty: ConcernInterestProfile = {
    acne: 0, spots: 0, dryness: 0, sensitivity: 0, sunscreen: 0,
    antiaging: 0, barrier: 0, pore: 0, serum: 0, haircare: 0,
    totalEvents: 0, hasEnoughData: false,
  };

  const [profile, setProfile] = useState<ConcernInterestProfile>(empty);

  useEffect(() => {
    getUserEvents()
      .then((events) => setProfile(computeConcernInterestProfile(events)))
      .catch(() => {});
  }, []);

  return profile;
}
