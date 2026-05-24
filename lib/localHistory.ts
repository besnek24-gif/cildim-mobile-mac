import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "@ciltbakim:local_history";
const MAX_HISTORY = 150;

export interface LocalHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  brand?: string;
  imageUrl?: string;
  score?: number;
  viewedAt: string;
}

export async function addToLocalHistory(
  entry: Omit<LocalHistoryEntry, "id" | "viewedAt">
): Promise<void> {
  try {
    const existing = await getLocalHistory();
    const filtered = existing.filter((e) => e.productId !== String(entry.productId));
    const newEntry: LocalHistoryEntry = {
      id: `${Date.now()}-${entry.productId}`,
      viewedAt: new Date().toISOString(),
      productId: String(entry.productId),
      productName: entry.productName,
      brand: entry.brand,
      imageUrl: entry.imageUrl,
      score: entry.score,
    };
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

export async function getLocalHistory(): Promise<LocalHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalHistoryEntry[];
  } catch {
    return [];
  }
}

export async function removeFromLocalHistory(id: string): Promise<LocalHistoryEntry[]> {
  try {
    const existing = await getLocalHistory();
    const updated = existing.filter((e) => e.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearLocalHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch { /* silent */ }
}
