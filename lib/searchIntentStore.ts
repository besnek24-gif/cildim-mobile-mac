/**
 * searchIntentStore — Basit singleton store
 * Home screen arama → DermoAsistan konu başlatma köprüsü.
 * URL params'tan daha güvenilir; tab her zaman mounted olduğundan
 * useFocusEffect + consume pattern kullanılıyor.
 */

let _pendingKonu: string | null = null;

/** Home screen'den çağır: konu param'ını sakla */
export function setSearchKonu(konu: string): void {
  _pendingKonu = konu;
}

/** DermoAsistan'da useFocusEffect içinde çağır: değeri oku ve sıfırla */
export function consumeSearchKonu(): string | null {
  const k = _pendingKonu;
  _pendingKonu = null;
  return k;
}
