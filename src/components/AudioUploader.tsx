"use client";

import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";

interface AudioUploaderProps {
  onTranscribe?: (file: File, title: string) => Promise<void> | void;
}

export default function AudioUploader({ onTranscribe }: AudioUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionName, setTranscriptionName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = selectedFile?.name ?? "";

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const validateAndSetFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    const ok =
      file.type.startsWith("audio/") ||
      file.type === "video/mp4" ||
      name.endsWith(".mp3") ||
      name.endsWith(".wav") ||
      name.endsWith(".m4a") ||
      name.endsWith(".ogg") ||
      name.endsWith(".flac") ||
      name.endsWith(".mp4");

    if (!ok) {
      setError("Please select a valid audio file (MP3, WAV, M4A, OGG, FLAC).");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setTranscriptionName(file.name);
    setIsModalOpen(true);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetFile(file);
    },
    [validateAndSetFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) validateAndSetFile(file);
    },
    [validateAndSetFile]
  );

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setTranscriptionName("");
    setIsModalOpen(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || isUploading) return;
    if (!onTranscribe) {
      setError("Transcription is not configured.");
      return;
    }

    const resolvedTitle =
      transcriptionName.trim().length > 0
        ? transcriptionName.trim()
        : selectedFile.name;

    setIsUploading(true);
    setError(null);

    try {
      setIsModalOpen(false);
      await onTranscribe(selectedFile, resolvedTitle);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transcription failed. Please try again.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, onTranscribe, selectedFile, transcriptionName]);

  React.useEffect(() => {
    if (!isModalOpen) return;
    const id = window.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isModalOpen]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,.mp3,.wav,.m4a,.ogg,.flac,.mp4"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={isUploading}
          className={[
            "w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
            "bg-[#fffef8] border-[#d8e0d2] hover:border-[#2d7b4e] shadow-[0_10px_30px_rgba(23,48,35,0.06)]",
            "dark:bg-[#122219] dark:border-white/10 dark:hover:border-[#b7e33d]/50",
            isDragOver ? "ring-2 ring-[#b7e33d]/50 border-[#2d7b4e]" : "",
            isUploading ? "opacity-70 cursor-not-allowed" : "",
          ].join(" ")}
          aria-label="Upload audio file"
        >
              <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[#e9f4c6] text-[#2d7b4e] dark:bg-[#b7e33d]/15 dark:text-[#dff69a]">
            <UploadCloud className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            {selectedFile ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {fileName}
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Drop an audio/MP4 file here
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="sm:hidden">Tap to browse</span>
                  <span className="hidden sm:inline">or click to browse (MP3, WAV, M4A, OGG, FLAC, MP4)</span>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearSelectedFile();
              }}
              className="shrink-0 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
              role="button"
              aria-label="Remove selected file"
              tabIndex={0}
            >
              <X className="w-4 h-4" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || isModalOpen}
          className="w-full md:w-auto px-7 py-4 rounded-2xl bg-[#b7e33d] text-[#173023] font-semibold text-sm hover:bg-[#c9f064] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#b7e33d]/20 transition active:scale-[0.98]"
        >
          {isUploading ? "Transcribing..." : "Transcribe"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#173023]/45 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e0d2] bg-[#fffef8] dark:border-white/10 dark:bg-[#122219] p-6 shadow-2xl shadow-[#173023]/20">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Name Your Transcription
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pick a name to help you find it later.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Transcription Name
              </label>
              <input
                ref={titleInputRef}
                autoFocus
                value={transcriptionName}
                onChange={(e) => setTranscriptionName(e.target.value)}
                placeholder={selectedFile?.name || "My transcription"}
                className="w-full rounded-xl border border-[#d8e0d2] bg-[#f3f5ed] px-4 py-3 text-sm text-[#173023] placeholder:text-[#69776d] focus:outline-none focus:ring-2 focus:ring-[#b7e33d]/60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={clearSelectedFile}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 text-sm font-medium dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl bg-[#173b29] text-[#e9f4c6] hover:bg-[#2d7b4e] text-sm font-semibold disabled:opacity-50"
              >
                {isUploading ? "Starting..." : "Start Transcription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
