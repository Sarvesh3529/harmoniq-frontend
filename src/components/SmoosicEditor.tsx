"use client";

/**
 * SmoosicEditor.tsx
 *
 * Interactive, point-and-click piano sheet music editor built on the
 * Smoosic library (https://github.com/Smoosic/Smoosic).
 *
 * Features:
 *  - Renders MusicXML from our AI backend inside Smoosic's full editing UI
 *  - Click-to-select notes with visual highlight
 *  - ArrowUp / ArrowDown  → diatonic pitch shift
 *  - Delete / Backspace   → remove note (rests fill automatically)
 *  - Web Audio API synth preview on every note selection / mutation
 *  - "Export MusicXML" button serialises the edited score back to XML
 *  - "Save Changes" callback to send the corrected XML upstream
 *
 * Integration:
 *   <SmoosicEditor
 *     musicXmlData={xmlString}        // from Firestore musicXmlData field
 *     onSave={(updatedXml) => ...}    // persist corrected score
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Music, Save, Loader2, AlertCircle, Info } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SmoosicEditorProps {
  /** Raw MusicXML string from the AI backend */
  musicXmlData: string;
  /** Called with the updated MusicXML when the user clicks "Save Changes" */
  onSave?: (updatedMusicXml: string) => void | Promise<void>;
  /** Height of the editor container in CSS units (default: "680px") */
  height?: string;
}

// Smoosic types (minimal, to avoid importing the heavy type bundle at type-check time)
type SuiApplicationType = {
  score?: unknown;
  view?: {
    changeScore: (score: unknown) => Promise<void>;
    renderer: { renderPromise: () => Promise<void> };
    tracker?: {
      selections?: unknown[];
    };
    crescendoMode?: unknown;
    deleteNote?: () => Promise<void>;
    transposeSelections?: (semitones: number) => Promise<void>;
  };
};

/** Smoosic v2 converts a parsed XML document, not an { xml } constructor value. */
function parseMusicXml(Smoosic: any, musicXml: string): unknown {
  const document = new DOMParser().parseFromString(musicXml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("The generated MusicXML is invalid.");
  }
  return Smoosic.XmlToSmo.convert(document);
}

function scoreToMusicXml(Smoosic: any, app: SuiApplicationType): string {
  const view = app.view as any;
  const score = view?.score ?? view?.storeScore ?? view?.renderer?.score ?? app.score;
  if (!score) throw new Error("Cannot access score object.");
  return new XMLSerializer().serializeToString(Smoosic.SmoToXml.convert(score));
}

// ─── Tone-free Web Audio piano synth ──────────────────────────────────────────

class PianoSynth {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  /** Play a MIDI pitch (0-127) for a given duration in seconds */
  playMidi(midiPitch: number, durationSeconds = 0.6) {
    try {
      const ctx = this.getCtx();
      if (ctx.state === "suspended") ctx.resume();

      const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);

      // Oscillator — triangle + slight detuned sine for a piano-ish timbre
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "triangle";
      osc1.frequency.value = freq;

      osc2.type = "sine";
      osc2.frequency.value = freq * 1.002; // slight detune for warmth

      // Fast attack, medium decay, piano-like exponential release
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSeconds + 0.05);
      osc2.stop(now + durationSeconds + 0.05);
    } catch (e) {
      // Best-effort; audio not critical
      console.warn("[SmoosicEditor] Audio preview failed:", e);
    }
  }

  /** Convert a note letter + octave to MIDI pitch */
  static noteToMidi(letter: string, octave: number, alter: number = 0): number {
    const map: Record<string, number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    };
    return (octave + 1) * 12 + (map[letter.toUpperCase()] ?? 0) + Math.round(alter);
  }
}

const synth = new PianoSynth();

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the first note's pitch from a Smoosic selection array (best-effort) */
function extractMidiFromSelection(selections: unknown[]): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel = selections[0] as any;
    const note = sel?.note;
    if (!note) return null;
    const pitch = note.pitches?.[0] ?? note.pitch;
    if (!pitch) return null;
    const letter: string = pitch.letter ?? pitch.step ?? "C";
    const octave: number = pitch.octave ?? 4;
    const alter: number = pitch.accidental ?? pitch.alter ?? 0;
    return PianoSynth.noteToMidi(letter, octave, alter);
  } catch {
    return null;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SmoosicEditor({
  musicXmlData,
  onSave,
  height = "680px",
}: SmoosicEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<SuiApplicationType | null>(null);
  const xmlDataRef = useRef<string>(musicXmlData); // latest XML without triggering re-init

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("Initialising editor…");
  const [isExporting, setIsExporting] = useState(false);
  const [hasScore, setHasScore] = useState(false);

  // ── Keep XML ref in sync without re-mounting ────────────────────────────────
  useEffect(() => {
    xmlDataRef.current = musicXmlData;
  }, [musicXmlData]);

  // ── Mount Smoosic once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    if (!musicXmlData?.trim()) {
      setIsLoading(false);
      setStatusMsg("No score data available yet.");
      return;
    }

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      setStatusMsg("Loading Smoosic engine…");

      try {
        // Dynamic import keeps Smoosic out of the server bundle
        const Smoosic = await import("smoosic");

        if (cancelled || !containerRef.current) return;

        setStatusMsg("Parsing MusicXML…");

        // Full application mode supplies Smoosic's selectable-note editor UI.
        // Its initialScore parser also correctly handles MusicXML.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SuiApplication: any = Smoosic.SuiApplication;

        if (cancelled || !containerRef.current) return;
        setStatusMsg("Starting interactive editor…");

        // Initialise Smoosic with its editor controls and note-selection handlers.
        const app: SuiApplicationType = await SuiApplication.configure({
          mode: "application",
          domContainer: containerRef.current,
          idleRedrawTime: 1,
          demonPollTime: 1,
          initialScore: xmlDataRef.current,
        });

        if (cancelled) return;
        appRef.current = app;

        setHasScore(true);
        setIsLoading(false);
        setStatusMsg("Click a note to select it, then use ↑↓ to edit pitch.");
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[SmoosicEditor] init error:", err);
        setError(`Failed to initialise editor: ${msg}`);
        setIsLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
    // We intentionally run only once on mount with the initial XML.
    // Subsequent XML updates are handled by the loadNewScore helper below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reload score when musicXmlData changes after mount ──────────────────────
  useEffect(() => {
    const app = appRef.current;
    if (!app?.view || !musicXmlData?.trim()) return;

    const reload = async () => {
      setIsLoading(true);
      setStatusMsg("Reloading score…");
      try {
        const Smoosic = await import("smoosic");
        const score = parseMusicXml(Smoosic, musicXmlData);
        await app.view!.changeScore(score);
        await app.view!.renderer.renderPromise();
        setHasScore(true);
        setStatusMsg("Click a note to select it, then use ↑↓ to edit pitch.");
      } catch (err) {
        console.warn("[SmoosicEditor] reload error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXmlData]);

  // ── Keyboard handler: pitch shift & delete ──────────────────────────────────
  useEffect(() => {
    const handleKey = async (e: KeyboardEvent) => {
      const app = appRef.current;
      if (!app?.view) return;

      // Only intercept when the editor container has focus or a note is selected
      if (!containerRef.current?.contains(document.activeElement) &&
          !(app.view.tracker?.selections?.length)) return;

      const view = app.view;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        try {
          await view.transposeSelections?.(1);
          // Play audio preview of new pitch
          const sels = view.tracker?.selections ?? [];
          if (sels.length) {
            const midi = extractMidiFromSelection(sels);
            if (midi !== null) synth.playMidi(midi + 2); // rough up estimate
          }
        } catch (err) {
          console.warn("[SmoosicEditor] upPitch failed:", err);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        try {
          await view.transposeSelections?.(-1);
          const sels = view.tracker?.selections ?? [];
          if (sels.length) {
            const midi = extractMidiFromSelection(sels);
            if (midi !== null) synth.playMidi(midi - 2);
          }
        } catch (err) {
          console.warn("[SmoosicEditor] downPitch failed:", err);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        try {
          await view.deleteNote?.();
        } catch (err) {
          console.warn("[SmoosicEditor] deleteNote failed:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Click-to-play: intercept pointer events on the SVG canvas ───────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const app = appRef.current;
      if (!app?.view) return;

      // Slight delay to let Smoosic process its own click handler first
      setTimeout(() => {
        try {
          const sels = app.view?.tracker?.selections ?? [];
          if (sels.length) {
            const midi = extractMidiFromSelection(sels);
            if (midi !== null) synth.playMidi(midi);
          }
        } catch {
          // ignore
        }
      }, 80);
    };

    el.addEventListener("click", handleClick, { capture: false });
    return () => el.removeEventListener("click", handleClick, { capture: false });
  }, []);

  // ── Export: serialize score back to MusicXML ────────────────────────────────
  const handleExportXml = useCallback(async () => {
    const app = appRef.current;
    if (!app?.view) return;
    setIsExporting(true);
    try {
      const Smoosic = await import("smoosic");
      const xmlStr = scoreToMusicXml(Smoosic, app);

      // Trigger download
      const blob = new Blob([xmlStr], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited-score.musicxml";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[SmoosicEditor] export error:", err);
      setError("Export failed. Check console for details.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  // ── Save: call parent callback with updated MusicXML ─────────────────────────
  const handleSave = useCallback(async () => {
    const app = appRef.current;
    if (!app?.view || !onSave) return;
    setIsSaving(true);
    try {
      const Smoosic = await import("smoosic");
      const xmlStr = scoreToMusicXml(Smoosic, app);
      await onSave(xmlStr);
    } catch (err) {
      console.error("[SmoosicEditor] save error:", err);
      setError("Save failed. Check console for details.");
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      id="sheet-music-editor"
      className="smoosic-editor-root flex flex-col w-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-[0_24px_72px_-32px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_32px_96px_-40px_rgba(8,15,30,0.9)]"
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="smoosic-toolbar flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white dark:border-white/8 dark:from-slate-900/80 dark:to-slate-950/80 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Music className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Score Editor
            </p>
            <p className="hidden text-[11px] text-slate-400 sm:block dark:text-slate-500">
              Powered by Smoosic
            </p>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          <span className="font-mono bg-white border border-slate-200 rounded px-1 py-0.5 dark:bg-slate-800 dark:border-white/10">↑↓</span>
          <span>pitch</span>
          <span className="mx-1 opacity-40">·</span>
          <span className="font-mono bg-white border border-slate-200 rounded px-1 py-0.5 dark:bg-slate-800 dark:border-white/10">Del</span>
          <span>remove</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              id="smoosic-save-btn"
              onClick={() => void handleSave()}
              disabled={!hasScore || isSaving}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Save changes"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          )}
          <button
            id="smoosic-export-btn"
            onClick={() => void handleExportXml()}
            disabled={!hasScore || isExporting}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-white/14"
            aria-label="Export MusicXML"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export XML
          </button>
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────────── */}
      {(isLoading || statusMsg) && !error && (
        <div className="flex items-center gap-2 px-5 py-2 text-xs text-slate-500 bg-blue-50/50 border-b border-blue-100/60 dark:bg-indigo-950/30 dark:border-indigo-900/30 dark:text-slate-400">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 flex-shrink-0" />
          ) : (
            <Info className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 px-5 py-3 text-xs text-rose-700 bg-rose-50 border-b border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Smoosic container ─────────────────────────────────────────────────── */}
      {/*
        IMPORTANT: Smoosic mounts directly into this div, injecting its own
        SVG canvases, toolbars, and dialogs.  We must NOT clear or replace
        this div's children after the initial mount.
      */}
      <div
        ref={containerRef}
        id="smoosic-inner-container"
        className="smoosic-canvas-host relative w-full bg-white dark:bg-white flex-1 overflow-auto"
        style={{ minHeight: height, height }}
        tabIndex={0}  // make focusable so keyboard events work
        aria-label="Sheet music editor canvas"
      />
    </div>
  );
}
