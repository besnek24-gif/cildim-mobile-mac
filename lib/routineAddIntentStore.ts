/**
 * routineAddIntentStore.ts — "Rutinime Ekle" intent köprüsü (ECZ4)
 *
 * Lightweight module-level singleton. productStore + recommendationFlowStore
 * pattern'iyle aynı; persist yok, Zustand/Context yok, yalnız bellekte tutar.
 *
 * Akış:
 *   OverviewPipeline (ürün detay) → setRoutineAddIntent(...)
 *     → router.push("/(tabs)/rutin?fromProductAdd=1")
 *   Rutinim sayfası odaklandığında → consumeRoutineAddIntent()
 *     → manuel/no-routine: addStep + Alert
 *     → v2 aktif veya unsupported bucket: re-set + duzenle'ye yönlendir
 *
 * TTL: 2 dakika (kullanıcı detay → tab geçiş süresi için fazlasıyla yeterli;
 * stale intent'in haftalar sonra tetiklenmesini engeller).
 */

const TTL_MS = 2 * 60 * 1000;

export interface RoutineAddIntent {
  productId:       string;
  productName?:    string;
  productBrand?:   string;
  productCategory?: string;
  sourceRoute?:    string;
  sourceParams?:   Record<string, string>;
  ts:              number;
}

let _intent: RoutineAddIntent | null = null;

export function setRoutineAddIntent(intent: RoutineAddIntent): void {
  _intent = intent;
}

/** TTL geçmişse otomatik temizler ve null döner. Mutate etmez. */
export function getRoutineAddIntent(): RoutineAddIntent | null {
  if (!_intent) return null;
  if (Date.now() - _intent.ts > TTL_MS) {
    _intent = null;
    return null;
  }
  return _intent;
}

/** getRoutineAddIntent + drain. İkinci çağrı null döner. */
export function consumeRoutineAddIntent(): RoutineAddIntent | null {
  const cur = getRoutineAddIntent();
  _intent = null;
  return cur;
}

export function clearRoutineAddIntent(): void {
  _intent = null;
}
