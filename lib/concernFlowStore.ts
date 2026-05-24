type AnyProfile = Record<string, unknown>;
const _store: Record<string, AnyProfile> = {};

export function setConcernProfile(flow: string, profile: AnyProfile): void {
  _store[flow] = profile;
}

export function getConcernProfile(flow: string): AnyProfile | null {
  return _store[flow] ?? null;
}
