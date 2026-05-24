/**
 * homeResetStore.ts
 *
 * Module-level callback registry for resetting home search state.
 * Mirrors the pattern of homeScrollRef.ts — no React context, no re-renders.
 *
 * Usage:
 *   Home screen:  registerHomeResetCallback(() => { setQuery(""); ... });
 *   Tab layout:   resetHomeSearch();
 */

type ResetCallback = () => void;

let _callback: ResetCallback | null = null;

/** Called by HomeScreen on mount to register its state-clear function. */
export function registerHomeResetCallback(cb: ResetCallback): void {
  _callback = cb;
}

/** Called by the tab press listener to clear all search state in HomeScreen. */
export function resetHomeSearch(): void {
  try {
    _callback?.();
  } catch {
    // Fail silently — component may have unmounted
  }
}
