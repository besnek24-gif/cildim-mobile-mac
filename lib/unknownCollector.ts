let UNKNOWN_POOL: { raw: string; normalized: string }[] = [];

export function addUnknownCandidates(candidates: { raw: string; normalized: string }[]) {
  for (const c of candidates) {
    const exists = UNKNOWN_POOL.find(
      x => x.normalized === c.normalized
    );
    if (!exists) {
      UNKNOWN_POOL.push(c);
    }
  }
}

export function getUnknownPool() {
  return UNKNOWN_POOL;
}

export function clearUnknownPool() {
  UNKNOWN_POOL = [];
}
