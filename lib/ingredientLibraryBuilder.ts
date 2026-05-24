export interface LibraryEntry {
  canonical_name: string;
  aliases: string[];
  category: string;
  risk_level: string;
  flags: string[];
}

export function buildLibraryEntries(
  candidates: { raw: string; normalized: string }[]
): LibraryEntry[] {
  return candidates.map((candidate) => ({
    canonical_name: candidate.normalized,
    aliases: [candidate.raw, candidate.normalized],
    category: "unknown",
    risk_level: "unknown",
    flags: [],
  }));
}
