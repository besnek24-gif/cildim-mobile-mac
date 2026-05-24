import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "@dermoasistan:threads";
const MAX_THREADS = 20;
const TITLE_MAX = 56;

export interface DermoAsistanMessage {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
  streaming?: boolean;
  failed?: boolean;
  createdAt?: string | number;
}

export interface DermoAsistanThread {
  id: string;
  title: string;
  mode?: string;
  topic?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: DermoAsistanMessage[];
}

function trimTitle(raw: string): string {
  const clean = (raw || "").replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX) return clean;
  return clean.slice(0, TITLE_MAX - 1).trimEnd() + "…";
}

function sanitizeMessages(messages: DermoAsistanMessage[]): DermoAsistanMessage[] {
  return (messages ?? [])
    .filter(m => m && (m.role === "user" || m.role === "assistant"))
    .filter(m => !m.streaming)
    .filter(m => !m.failed)
    .filter(m => typeof m.content === "string" && m.content.trim().length > 0)
    .map(m => ({
      role: m.role,
      content: m.content,
      hidden: m.hidden ?? false,
      createdAt: m.createdAt,
    }));
}

function hasMeaningfulConversation(messages: DermoAsistanMessage[]): boolean {
  const visibleUser = messages.some(m => m.role === "user" && !m.hidden && m.content.trim());
  const assistant   = messages.some(m => m.role === "assistant" && m.content.trim());
  return visibleUser && assistant;
}

export async function getDermoAsistanThreads(): Promise<DermoAsistanThread[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DermoAsistanThread[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(t => t && typeof t.id === "string" && Array.isArray(t.messages))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, MAX_THREADS);
  } catch {
    return [];
  }
}

export async function saveDermoAsistanThread(thread: DermoAsistanThread): Promise<void> {
  try {
    const cleanMessages = sanitizeMessages(thread.messages);
    if (!hasMeaningfulConversation(cleanMessages)) return;

    const nowIso = new Date().toISOString();
    const existing = await getDermoAsistanThreads();
    const filtered = existing.filter(t => t.id !== thread.id);

    const titleSource =
      (thread.title && thread.title.trim()) ||
      thread.topic ||
      cleanMessages.find(m => m.role === "user" && !m.hidden)?.content ||
      "DermoAsistan Sohbeti";

    const next: DermoAsistanThread = {
      id: thread.id,
      title: trimTitle(titleSource),
      mode: thread.mode,
      topic: thread.topic ?? null,
      createdAt: thread.createdAt || nowIso,
      updatedAt: nowIso,
      messages: cleanMessages,
    };

    const updated = [next, ...filtered].slice(0, MAX_THREADS);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* silent — never crash app */
  }
}

export async function deleteDermoAsistanThread(id: string): Promise<DermoAsistanThread[]> {
  try {
    const existing = await getDermoAsistanThreads();
    const updated = existing.filter(t => t.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearDermoAsistanThreads(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* silent */
  }
}

export function makeDermoAsistanThreadId(): string {
  return `da-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
