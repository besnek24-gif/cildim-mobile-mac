import { router } from "expo-router";

/**
 * openCompareDetail
 * ─────────────────────────────────────────────────────────────────────────────
 * SADECE rota açma yardımcısı. Karşılaştırma motoru içermez.
 * Mukayese detay sayfası (mukayese-detay.tsx) ve karşılaştırma motoru
 * (compareProducts) DOKUNULMAZ; bu helper sadece mevcut yolu çağırır.
 *
 * Kullanım:
 *   openCompareDetail(idA, idB)
 *
 * Eşit id verilirse rota açılmaz (defansif guard).
 */
export function openCompareDetail(idA: string | number, idB: string | number): void {
  const a = String(idA ?? "").trim();
  const b = String(idB ?? "").trim();
  if (!a || !b) return;
  if (a === b) return;
  router.push(`/mukayese-detay?idA=${a}&idB=${b}` as any);
}
