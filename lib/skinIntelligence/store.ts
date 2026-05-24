/**
 * Skin Intelligence — Zustand Store
 * 6 katmanlı analiz akışının tüm durumunu yönetir.
 * Eski routineStore veya concernFlowStore'a bağımlılık yok.
 */

import { create } from "zustand";
import type {
  AngleId,
  AnalysisResult,
  CaptureFrame,
  FlowStep,
  GeneratedRoutine,
  ProductMatchSet,
  SavedScan,
  ScanPackage,
  SkinSignal,
} from "./types";
import { ANGLE_ORDER } from "./types";

// ─── Durum Tanımı ────────────────────────────────────────────────────────────

type AnalysisStatus =
  | "idle"
  | "compressing"
  | "quick_pending"
  | "quick_ready"
  | "deep_pending"
  | "deep_ready"
  | "failed";

interface SkinIntelligenceState {
  // ── Navigation flow ───────────────────────────────────────────────────────
  currentStep: FlowStep;

  // ── Layer 1 & 2: Capture ─────────────────────────────────────────────────
  frames: CaptureFrame[];
  scanPackage: ScanPackage | null;

  // ── Layer 3: Analysis ─────────────────────────────────────────────────────
  analysisStatus: AnalysisStatus;
  analysis: AnalysisResult | null;
  quickAnalysis: AnalysisResult | null;
  analysisError: string | null;

  // ── Layer 4: Routine ──────────────────────────────────────────────────────
  routine: GeneratedRoutine | null;

  // ── Layer 5: Products ─────────────────────────────────────────────────────
  products: ProductMatchSet | null;

  // ── Layer 6: History ─────────────────────────────────────────────────────
  savedScans: SavedScan[];
  currentSavedScanId: string | null;

  // ── UI state ──────────────────────────────────────────────────────────────
  isDeepEnhancing: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  setStep: (step: FlowStep) => void;

  addFrame: (frame: CaptureFrame) => void;
  removeFrame: (angle: AngleId) => void;
  clearFrames: () => void;
  setScanPackage: (pkg: ScanPackage) => void;

  setAnalysisStatus: (status: AnalysisStatus) => void;
  setQuickAnalysis: (result: AnalysisResult) => void;
  setDeepAnalysis: (result: AnalysisResult) => void;
  setAnalysisError: (msg: string | null) => void;
  setIsDeepEnhancing: (v: boolean) => void;

  setRoutine: (routine: GeneratedRoutine) => void;
  setProducts: (products: ProductMatchSet) => void;

  addSavedScan: (scan: SavedScan) => void;
  setCurrentSavedScanId: (id: string | null) => void;

  reset: () => void;

  // ── Selectors ────────────────────────────────────────────────────────────
  capturedAngles: () => AngleId[];
  pendingAngles: () => AngleId[];
  overallCaptureQuality: () => number;
  topSignals: () => SkinSignal[];
}

// ─── Başlangıç Durumu ────────────────────────────────────────────────────────

const INITIAL: Omit<SkinIntelligenceState,
  | "setStep" | "addFrame" | "removeFrame" | "clearFrames" | "setScanPackage"
  | "setAnalysisStatus" | "setQuickAnalysis" | "setDeepAnalysis" | "setAnalysisError"
  | "setIsDeepEnhancing" | "setRoutine" | "setProducts" | "addSavedScan"
  | "setCurrentSavedScanId" | "reset" | "capturedAngles" | "pendingAngles"
  | "overallCaptureQuality" | "topSignals"
> = {
  currentStep: "capture",
  frames: [],
  scanPackage: null,
  analysisStatus: "idle",
  analysis: null,
  quickAnalysis: null,
  analysisError: null,
  routine: null,
  products: null,
  savedScans: [],
  currentSavedScanId: null,
  isDeepEnhancing: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSkinIntelligence = create<SkinIntelligenceState>()((set, get) => ({
  ...INITIAL,

  // ── Navigation ─────────────────────────────────────────────────────────
  setStep: (step) => set({ currentStep: step }),

  // ── Capture ────────────────────────────────────────────────────────────
  addFrame: (frame) =>
    set((s) => {
      const frames = [...s.frames];
      const idx = frames.findIndex((f) => f.angle === frame.angle);
      if (idx >= 0) frames[idx] = frame;
      else frames.push(frame);
      return { frames };
    }),

  removeFrame: (angle) =>
    set((s) => ({ frames: s.frames.filter((f) => f.angle !== angle) })),

  clearFrames: () => set({ frames: [], scanPackage: null }),

  setScanPackage: (pkg) => set({ scanPackage: pkg }),

  // ── Analysis ───────────────────────────────────────────────────────────
  setAnalysisStatus: (status) => set({ analysisStatus: status }),

  setQuickAnalysis: (result) =>
    set({ quickAnalysis: result, analysis: result, analysisStatus: "quick_ready", isDeepEnhancing: true }),

  setDeepAnalysis: (result) =>
    set({ analysis: result, analysisStatus: "deep_ready", isDeepEnhancing: false }),

  setAnalysisError: (msg) =>
    set({ analysisError: msg, analysisStatus: "failed", isDeepEnhancing: false }),

  setIsDeepEnhancing: (v) => set({ isDeepEnhancing: v }),

  // ── Routine ────────────────────────────────────────────────────────────
  setRoutine: (routine) => set({ routine }),

  // ── Products ───────────────────────────────────────────────────────────
  setProducts: (products) => set({ products }),

  // ── History ────────────────────────────────────────────────────────────
  addSavedScan: (scan) =>
    set((s) => ({ savedScans: [scan, ...s.savedScans], currentSavedScanId: scan.id })),

  setCurrentSavedScanId: (id) => set({ currentSavedScanId: id }),

  // ── Reset ──────────────────────────────────────────────────────────────
  reset: () => set({ ...INITIAL }),

  // ── Selectors ─────────────────────────────────────────────────────────
  capturedAngles: () => get().frames.map((f) => f.angle),

  pendingAngles: () => {
    const captured = new Set(get().frames.map((f) => f.angle));
    return ANGLE_ORDER.filter((a) => !captured.has(a));
  },

  overallCaptureQuality: () => {
    const frames = get().frames;
    if (frames.length === 0) return 0;
    return Math.round(frames.reduce((s, f) => s + f.quality.score, 0) / frames.length);
  },

  topSignals: () =>
    (get().analysis?.signals ?? []).filter((s) => s.confidence !== "low").slice(0, 3),
}));
