"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { downloadFullDocumentPdf } from "../lib/fullDocumentPdf";
import {
  Download,
  FileAudio,
  FileMusic,
  Loader2,
  Mic,
  Moon,
  Sparkles,
  Square,
  Sun,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { convertBlobToWavFile } from "@/lib/audioFile";

type OSMDInstance = {
  load: (xml: string) => Promise<void>;
  render: () => void;
  setOptions?: (options: Record<string, unknown>) => void;
  EngravingRules?: {
    MinMeasureWidth?: number;
    MaxMeasureWidth?: number;
  };
};

export interface AuraTranscribeDashboardProps {
  initialMusicXml?: string;
  initialMidiUrl?: string | null;
  initialMidiFileName?: string;
  onAudioSelected?: (file: File) => void;
  onAnalyze?: () => void | Promise<void>;
  isAnalyzing?: boolean;
  apiError?: string | null;
}

export function AuraTranscribeDashboard({
  initialMusicXml = "",
  initialMidiUrl = null,
  initialMidiFileName = "aura-transcribe.mid",
  onAudioSelected,
  onAnalyze,
  isAnalyzing = false,
  apiError = null,
}: AuraTranscribeDashboardProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [musicXml, setMusicXml] = useState(initialMusicXml);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OSMDInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const fileInputId = useId();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem("aura-theme");
    const nextTheme = storedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("aura-theme", theme);
  }, [theme]);

  useEffect(() => {
    setMusicXml(initialMusicXml);
  }, [initialMusicXml]);

  useEffect(() => {
    let cancelled = false;

    async function renderSheet() {
      if (!musicXml.trim() || !containerRef.current) {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
        return;
      }

      setIsRendering(true);
      setRenderError(null);

      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (cancelled || !containerRef.current) {
          return;
        }

        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: true,
            backend: "svg",
            drawTitle: false,
            drawingParameters: "compacttight",
            pageFormat: "Endless",
            renderSingleHorizontalStaffline: false,
            spacingFactorSoftmax: 4,
            stretchLastSystemLine: false,
          }) as unknown as OSMDInstance;
        } else {
          osmdRef.current.setOptions?.({
            drawingParameters: "compacttight",
            pageFormat: "Endless",
            renderSingleHorizontalStaffline: false,
            spacingFactorSoftmax: 4,
            stretchLastSystemLine: false,
          });
        }

        if (osmdRef.current.EngravingRules) {
          osmdRef.current.EngravingRules.MinMeasureWidth = 118;
          osmdRef.current.EngravingRules.MaxMeasureWidth = 165;
        }

        await osmdRef.current.load(musicXml);
        if (cancelled) {
          return;
        }

        osmdRef.current.render();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to render the MusicXML score.";
        setRenderError(message);
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderSheet();

    return () => {
      cancelled = true;
    };
  }, [musicXml]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const handleResize = () => {
      osmdRef.current?.render();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMounted]);

  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, []);

  const hasResult = musicXml.trim().length > 0;
  const hasSelectedAudio = audioFile !== null;
  const statusLabel = isAnalyzing
    ? "Transcribing..."
    : hasResult
      ? "Result Ready"
      : hasSelectedAudio
        ? "Queued"
        : "Waiting";

  function handleAudioFile(file: File) {
    setAudioFile(file);
    setRecordingError(null);
    onAudioSelected?.(file);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) {
      handleAudioFile(nextFile);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) {
      handleAudioFile(nextFile);
    }
  }

  async function handleRecordButtonClick() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setRecordingError("This browser does not support in-app microphone recording.");
      return;
    }

    setRecordingError(null);
    setRecordingDurationSeconds(0);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const mimeType = getPreferredRecordingMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setRecordingError("Microphone recording failed. Please try again.");
        cleanupRecordingResources();
        setIsRecording(false);
      };

      mediaRecorder.onstop = () => {
        void finalizeRecording();
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDurationSeconds((current) => current + 1);
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Microphone access was blocked or could not be started.";
      setRecordingError(message);
      cleanupRecordingResources();
      setIsRecording(false);
    }
  }

  async function finalizeRecording() {
    const chunks = recordedChunksRef.current;
    const mimeType = mediaRecorderRef.current?.mimeType || chunks[0]?.type || "audio/webm";
    cleanupRecordingResources();
    setIsRecording(false);

    if (chunks.length === 0) {
      setRecordingError("No audio was captured. Please try recording again.");
      return;
    }

    try {
      const recordedBlob = new Blob(chunks, {
        type: mimeType,
      });
      const recordedFile = await convertBlobToWavFile(recordedBlob);
      handleAudioFile(recordedFile);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Recorded audio could not be prepared for transcription.";
      setRecordingError(message);
    } finally {
      recordedChunksRef.current = [];
      setRecordingDurationSeconds(0);
    }
  }

  function cleanupRecordingResources() {
    if (recordingTimerRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function handleDownloadPdf() {
    if (!musicXml.trim()) {
      return;
    }

    await downloadFullDocumentPdf(musicXml, "aura-transcribe-score");
  }

  function handleDownloadMidi() {
    if (!initialMidiUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = initialMidiUrl;
    link.download = initialMidiFileName;
    link.click();
  }

  return (
    <section className="min-h-screen px-4 py-6 text-slate-900 transition-colors dark:text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-between px-1"
        >
          <div className="text-lg font-semibold tracking-[0.12em] text-slate-900 dark:text-slate-100">
            AuraTranscribe
          </div>
          <button
            type="button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_10px_40px_-18px_rgba(56,189,248,0.65)] dark:backdrop-blur-xl dark:hover:bg-white/14"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_-38px_rgba(15,23,42,0.22)] transition-colors dark:border-white/10 dark:bg-white/8 dark:shadow-[0_35px_100px_-45px_rgba(8,15,30,0.9)] dark:backdrop-blur-2xl"
        >
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.55),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.95))] px-6 py-6 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_36%),radial-gradient(circle_at_right,_rgba(129,140,248,0.14),_transparent_24%),linear-gradient(180deg,_rgba(15,23,42,0.72),_rgba(9,15,30,0.62))] sm:px-8 sm:py-7">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                  Status: <span className="font-medium text-slate-900">{statusLabel}</span>
                </div>
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700 shadow-sm">
                  Engine: <span className="font-medium text-sky-900">Transkun V2</span>
                </div>
                {audioFile ? (
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                    <FileAudio className="mr-2 inline h-4 w-4 text-slate-500" />
                    {audioFile.name}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <AnimatePresence mode="wait">
              {!hasSelectedAudio && !hasResult ? (
                <motion.div
                  key="hero-upload"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <label
                    htmlFor={fileInputId}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={[
                      "group flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed px-8 py-10 text-center transition-all",
                      isDragging
                        ? "border-sky-400 bg-sky-50"
                        : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/10">
                      <Upload className="h-8 w-8" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-slate-950">
                      Drop your audio here
                    </h2>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <Button
                        type="button"
                        className="h-11 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
                        onClick={(event) => {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Choose Audio File
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isAnalyzing}
                        className={[
                          "h-11 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                          isRecording ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "",
                        ].join(" ")}
                        onClick={(event) => {
                          event.preventDefault();
                          void handleRecordButtonClick();
                        }}
                      >
                        {isRecording ? (
                          <Square className="mr-2 h-4 w-4" />
                        ) : (
                          <Mic className="mr-2 h-4 w-4" />
                        )}
                        {isRecording
                          ? `Stop Recording (${formatDuration(recordingDurationSeconds)})`
                          : "Record Audio"}
                      </Button>
                      <span className="text-sm text-slate-500">
                        WAV, MP3, OGG, FLAC, M4A, AAC, MP4
                      </span>
                    </div>
                    {recordingError ? (
                      <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {recordingError}
                      </div>
                    ) : null}
                    <input
                      id={fileInputId}
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/mp4,.mp4"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="result-flow"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5 shadow-sm transition-colors dark:border-white/10 dark:bg-white/6 dark:shadow-none">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-slate-200 bg-white text-slate-700">
                            Input Summary
                          </Badge>
                          {isAnalyzing ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                              Processing
                            </Badge>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-950">
                            {audioFile?.name ?? "No file selected"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-11 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={(event) => {
                            event.preventDefault();
                            fileInputRef.current?.click();
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Replace File
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isAnalyzing}
                          className={[
                            "h-11 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                            isRecording ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "",
                          ].join(" ")}
                          onClick={(event) => {
                            event.preventDefault();
                            void handleRecordButtonClick();
                          }}
                        >
                          {isRecording ? (
                            <Square className="mr-2 h-4 w-4" />
                          ) : (
                            <Mic className="mr-2 h-4 w-4" />
                          )}
                          {isRecording
                            ? `Stop Recording (${formatDuration(recordingDurationSeconds)})`
                            : "Record New Take"}
                        </Button>
                        <Button
                          type="button"
                          disabled={!hasSelectedAudio || isAnalyzing}
                          className="h-11 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
                          onClick={(event) => {
                            event.preventDefault();
                            void onAnalyze?.();
                          }}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {isAnalyzing ? "Analyzing..." : "Run Again"}
                        </Button>
                        <input
                          id={fileInputId}
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*,video/mp4,.mp4"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {apiError ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {apiError}
                      </div>
                    ) : null}
                    {recordingError ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {recordingError}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.3)] transition-colors dark:border-white/10 dark:bg-white/8 dark:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.9)] dark:backdrop-blur-2xl sm:p-6">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
                          Sheet Music
                        </h2>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={handleDownloadPdf}
                          disabled={!hasResult || isRendering}
                          className="h-11 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </Button>
                        <Button
                          onClick={handleDownloadMidi}
                          disabled={!initialMidiUrl}
                          variant="secondary"
                          className="h-11 rounded-full border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <FileMusic className="mr-2 h-4 w-4" />
                          Export MIDI
                        </Button>
                      </div>
                    </div>

                    <div className="relative mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-inner transition-colors dark:border-white/10 dark:bg-slate-950/30">
                      <AnimatePresence>
                        {isRendering ? (
                          <motion.div
                            key="rendering"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-slate-950/55"
                          >
                            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg dark:border-white/10 dark:bg-white/12 dark:text-slate-100 dark:backdrop-blur-xl">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Rendering score...
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {!hasResult ? (
                        <div className="flex min-h-[420px] items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500 sm:min-h-[560px]">
                          Upload a file to preview the score.
                        </div>
                      ) : null}

                      <div
                        id="sheet-container"
                        ref={containerRef}
                        className="min-h-[420px] overflow-x-auto bg-white p-4 dark:bg-white sm:min-h-[560px] sm:p-8"
                      />
                    </div>

                    {renderError ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {renderError}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function getPreferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
