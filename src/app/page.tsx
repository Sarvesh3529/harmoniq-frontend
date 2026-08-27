"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { downloadFullDocumentPdf } from "../lib/fullDocumentPdf";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { db } from "../lib/firebase";
import AudioUploader from '../components/AudioUploader';
import SheetMusicViewer, { enforcePianoGrandStaff } from "../components/SheetMusicViewer";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc
} from "firebase/firestore";
import {
  Upload,
  FileAudio,
  Music,
  Settings,
  LayoutDashboard,
  X,
  Search,
  Menu,
  LogIn,
  Download,
  FileMusic,
  AudioWaveform,
  Sparkles,
  CircleCheck,
  Sun,
  Moon,
  ArrowUpRight,
} from "lucide-react";

interface Transcription {
  id: string;
  title: string;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  midiUrl?: string | null;
  musicXmlUrl?: string | null;
  pdfUrl?: string | null;
  musicXmlData?: string | null;
  pianoRollMatrix?: string | null;
  errorMessage?: string | null;
  error_message?: string | null;
  createdAt?: number;
}

interface SidebarProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  status: string;
  transcriptions: Transcription[];
  selectedTrackId: string | null;
  onSelectTrack: (track: Transcription) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  user: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
    isAnonymous?: boolean;
  } | null;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({
  isMenuOpen,
  setIsMenuOpen,
  activeTab,
  setActiveTab,
  status,
  transcriptions,
  selectedTrackId,
  onSelectTrack,
  searchQuery,
  setSearchQuery,
  user,
  logout,
  loginWithGoogle
}) => {
  return (
    <>
      {isMenuOpen && <button type="button" aria-label="Close sidebar" onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-40 bg-[#173023]/35 backdrop-blur-[2px] md:hidden" />}
      <aside className={["fixed left-0 top-0 z-50 flex h-full flex-col justify-between border-r border-[#b7e33d]/25 bg-[#173b29] py-5 text-emerald-50 shadow-2xl shadow-[#173023]/20 transition-all duration-300 ease-out dark:border-white/10 dark:bg-[#0c1a12]", "w-[18.5rem] px-5 -translate-x-full md:translate-x-0", isMenuOpen ? "translate-x-0" : "-translate-x-full", isMenuOpen ? "md:w-[18.5rem] md:px-5" : "md:w-[5.25rem] md:px-2"].join(" ")}>
        <div className="flex h-[calc(100%-110px)] w-full flex-col gap-7">
          <div className="flex h-20 w-full items-center justify-between border-b border-white/10 pb-3">
            {isMenuOpen ? <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b7e33d] text-[#173023] shadow-lg shadow-[#b7e33d]/10"><Music className="h-5 w-5" /></div><div><div className="text-[15px] font-black tracking-[0.16em]">HARMONIQ</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-100/55">Notation desk</div></div></div> : <button onClick={() => setIsMenuOpen(true)} className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b7e33d] text-[#173023] transition-transform active:scale-95" title="Open sidebar"><Menu className="h-5 w-5" /></button>}
            {isMenuOpen && <button onClick={() => setIsMenuOpen(false)} className="rounded-xl p-2 text-emerald-100/55 transition hover:bg-white/10 hover:text-white" title="Close sidebar"><X className="h-4 w-4" /></button>}
          </div>

          <nav className="flex w-full flex-col gap-2">
            <button disabled={status === 'processing'} onClick={() => setActiveTab("dashboard")} className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 transition active:scale-[0.98] ${activeTab === "dashboard" && !selectedTrackId ? "bg-[#b7e33d] font-semibold text-[#173023] shadow-lg shadow-[#b7e33d]/10" : "text-emerald-100/70 hover:bg-white/10 hover:text-white"}`}><LayoutDashboard className="h-4.5 w-4.5 flex-shrink-0" />{isMenuOpen && <span className="text-sm">Workspace</span>}</button>
            {isMenuOpen ? <div className="mt-1 flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5"><Search className="h-4 w-4 flex-shrink-0 text-emerald-100/45" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tracks..." className="w-full bg-transparent text-sm text-white placeholder:text-emerald-100/35 focus:outline-none" /></div> : <button onClick={() => setIsMenuOpen(true)} className="flex w-full items-center justify-center rounded-2xl p-3 text-emerald-100/65 transition hover:bg-white/10 hover:text-white"><Search className="h-5 w-5" /></button>}
          </nav>

          {isMenuOpen && <div className="mt-1 flex-1 space-y-2 overflow-y-auto px-1"><p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-100/40">Recent scores</p>{transcriptions.length === 0 ? <p className="px-1 text-xs italic text-emerald-100/40">No scores yet</p> : <div className="flex flex-col gap-1">{transcriptions.map((track) => <button key={track.id} onClick={() => onSelectTrack(track)} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedTrackId === track.id ? "border-[#b7e33d]/40 bg-[#b7e33d]/15 text-[#e9f4c6]" : "border-transparent text-emerald-100/65 hover:bg-white/10 hover:text-white"}`}><FileAudio className={`h-4 w-4 flex-shrink-0 ${selectedTrackId === track.id ? "text-[#b7e33d]" : "text-emerald-100/40 group-hover:text-emerald-100/75"}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{track.title}</p><p className="mt-1 truncate text-[10px] text-emerald-100/40">{track.createdAt ? new Date(track.createdAt).toLocaleDateString() : "Recent"}</p></div></button>)}</div>}</div>}
        </div>

        <div className="flex w-full flex-col gap-3">
          <button disabled={status === 'processing'} onClick={() => setActiveTab("settings")} className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 transition active:scale-[0.98] ${activeTab === "settings" ? "bg-[#b7e33d] font-semibold text-[#173023]" : "text-emerald-100/70 hover:bg-white/10 hover:text-white"}`}><Settings className="h-4.5 w-4.5 flex-shrink-0" />{isMenuOpen && <span className="text-sm">Settings</span>}</button>
          <div onClick={() => { if (user?.isAnonymous) loginWithGoogle(); else if (confirm("Sign out of your session?")) logout(); }} className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-2.5 transition hover:border-[#b7e33d]/30 hover:bg-white/10" title={user?.isAnonymous ? "Click to sign in" : "Click to sign out"}><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#b7e33d]/45 bg-[#b7e33d]/15 text-sm font-bold text-[#dff69a]">{user?.photoURL ? <img src={user.photoURL} alt={user?.displayName ? `${user.displayName} avatar` : "Avatar"} className="h-9 w-9 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : (user?.isAnonymous ? "G" : (user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"))}</div>{isMenuOpen && <div className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{user?.isAnonymous ? "Guest User" : (user?.displayName || "User")}</span><span className="mt-0.5 block truncate text-[10px] text-emerald-100/45">{user?.isAnonymous ? "Sign in to save runs" : "Sign out"}</span></div>}</div>
        </div>
      </aside>
    </>
  );
};

const ProcessingView: React.FC<{ step: number }> = ({ step }) => {
  const steps = [
    "Idle",
    "Uploading target track to server framework...",
    "Decoding acoustic frequencies & signal transformations...",
    "Quantizing note frames & layout metric alignment...",
    "Rendering dynamic digital structural music notation XML...",
    "Finalizing structural sheet asset exports..."
  ];

  return (
    <div className="relative z-20 mx-auto flex min-h-[400px] max-w-md flex-col items-center justify-center space-y-6 text-center">
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-2 border-[#2d7b4e]/20 border-t-[#2d7b4e]" />
        <Music className="absolute h-6 w-6 animate-pulse text-[#2d7b4e]" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Processing audio</h3>
        <p className="min-h-[20px] text-sm text-[var(--muted)] transition-all">{steps[step] || "Working..."}</p>
      </div>
    </div>
  );
};

const ScoreViewer: React.FC<{ sheetMusicData?: string | null }> = ({ sheetMusicData }) => (
  <div className="flex min-h-[520px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
    {sheetMusicData ? (
      <SheetMusicViewer musicXmlData={sheetMusicData} />
    ) : (
      <p className="font-mono text-sm text-[var(--muted)]">No sheet music structural output loaded.</p>
    )}
  </div>
);

const PYTHON_API =
  process.env.NEXT_PUBLIC_PYTHON_API_URL || "https://sarvesh3529-harmoniq.hf.space/transcribe";
const MAX_FILE_SIZE_MB = 5;

export default function Dashboard() {
  const { user, loading: authLoading, loginWithGoogle, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [processingStep, setProcessingStep] = useState(0);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptionData, setTranscriptionData] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [currentSheetMusic, setCurrentSheetMusic] = useState<string | null>(null);
  const [currentMidiBase64, setCurrentMidiBase64] = useState<string | null>(null);
  const [currentMidiUrl, setCurrentMidiUrl] = useState<string | null>(null);

  const [isDragActive, setIsDragActive] = useState(false);


  // Sync state history relative data scoped to the active user subcollection
  useEffect(() => {
    if (!user) {
      setTranscriptions([]);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "transcriptions"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transcription[];

      setTranscriptions(docs);

      if (selectedTrackId) {
        const activeTrack = docs.find(t => t.id === selectedTrackId);
        if (activeTrack) {
          setStatus(activeTrack.status);
          if (activeTrack.status === 'completed') {
            setProcessingStep(4);
          }
        }
      }
    }, (err) => {
      console.error("Subcollection real-time sync failed:", err);
    });

    return () => unsubscribe();
  }, [user, selectedTrackId]);

  // Filter track list search matches
  const filteredTranscriptions = useMemo(() => {
    return transcriptions.filter(t =>
      t.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transcriptions, searchQuery]);

  // Load a historic item layout state parameters
  const handleSelectTrack = useCallback((track: Transcription) => {
    setSelectedTrackId(track.id);
    setActiveTab('dashboard');

    if (track.status === 'completed') {
      setStatus('completed');
      setCurrentTitle(track.title || null);
      setCurrentSheetMusic(track.musicXmlData || `Asset Sheet Record for: ${track.title}`);
      // midiDataBase64 lives on the full Firestore doc; cast via transcriptions list
      const fullDoc = transcriptions.find(t => t.id === track.id) as any;
      setCurrentMidiBase64(fullDoc?.midiDataBase64 || null);
      setCurrentMidiUrl(track.midiUrl || fullDoc?.midiUrl || null);
    } else if (track.status === 'failed') {
      setStatus('failed');
      setError(track.errorMessage || track.error_message || "This target transcription track run contains system faults.");
    } else {
      setStatus('processing');
      setProcessingStep(3);
    }
  }, [transcriptions]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setError(null);
    setSelectedFile(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith('audio/') &&
      !file.type.startsWith('video/mp4') &&
      !file.name.endsWith('.mp3') &&
      !file.name.endsWith('.wav') &&
      !file.name.endsWith('.mp4')
    ) {
      setError("Please select a valid audio or MP4 file format.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setError(null);
    setSelectedFile(file);
  }, []);

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const handleResetWorkspace = () => {
    setStatus('idle');
    setSelectedTrackId(null);
    setCurrentTitle(null);
    setCurrentSheetMusic(null);
    setCurrentMidiBase64(null);
    setCurrentMidiUrl(null);
  };

  // --- Download handlers ---

  const handleDownloadPdf = useCallback(async () => {
    if (!currentSheetMusic) return;

    try {
      await downloadFullDocumentPdf(
        currentSheetMusic,
        currentTitle || "transcription",
        enforcePianoGrandStaff,
      );
    } catch (err) {
      console.error("Full PDF export failed:", err);
      setError("The complete sheet-music PDF could not be generated.");
    }
  }, [currentSheetMusic, currentTitle]);

  const handleDownloadMidi = useCallback(() => {
    const safeName = (currentTitle || "transcription").replace(/[^a-z0-9_\-. ]/gi, "_");

    if (currentMidiBase64) {
      const binary = atob(currentMidiBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.mid`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!currentMidiUrl) return;
    const link = document.createElement("a");
    link.href = currentMidiUrl;
    link.download = `${safeName}.mid`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }, [currentMidiBase64, currentMidiUrl, currentTitle]);

  const handleUpload = useCallback(async (fileOverride?: File, titleOverride?: string) => {
    const fileToUpload = fileOverride ?? selectedFile;
    if (!fileToUpload || !user || isUploading) return;

    const resolvedTitle =
      typeof titleOverride === "string" && titleOverride.trim().length > 0
        ? titleOverride.trim()
        : fileToUpload.name;

    setIsUploading(true);
    setStatus('processing');
    setProcessingStep(1);
    setError(null);
    setSelectedTrackId(null);
    setCurrentTitle(null);
    setCurrentSheetMusic(null);

    let docId = "";

    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "transcriptions"), {
        title: resolvedTitle,
        status: "processing",
        musicXmlData: null,
        createdAt: Date.now(),
      });

      docId = docRef.id;
      setSelectedTrackId(docId);

      const interval = setInterval(() => {
        setProcessingStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 3000);

      const unsubDoc = onSnapshot(doc(db, "users", user.uid, "transcriptions", docId), (snapshot) => {
        const data = snapshot.data();
        if (data?.status === "completed") {
          clearInterval(interval);
          setProcessingStep(5);
          setStatus('completed');

          setCurrentTitle(data.title || resolvedTitle);
          setCurrentSheetMusic(data.musicXmlData || `Backup Sheet Data asset read successfully.`);
          setCurrentMidiBase64(data.midiDataBase64 || null);
          setCurrentMidiUrl(data.midiUrl || null);

          unsubDoc();
        } else if (data?.status === "failed") {
          clearInterval(interval);
          setStatus('failed');
          setError(data.errorMessage || data.error_message || "External space execution fault.");
          unsubDoc();
        }
      });

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("firestoreId", docId);
      formData.append("userId", user.uid);
      formData.append("title", resolvedTitle);
      // Send user profile metadata so the backend can upsert into Supabase public.users
      if (user.displayName) formData.append("userName", user.displayName);
      if (user.email) formData.append("userEmail", user.email);
      if (user.photoURL) formData.append("userPhotoUrl", user.photoURL);

      console.log(`Dispatching upload for Track ID: ${docId} under User: ${user.uid}`);

      const response = await fetch(PYTHON_API, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with status code: ${response.status}`);
      }

      const result = await response.json();
      console.log("Transcription successfully queued in background:", result);

    } catch (err: any) {
      console.error("Frontend upload handling failed:", err);
      setError(err.message || "Something went wrong during file upload connection.");
      setStatus('failed');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, user, isUploading]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-screen flex-col items-center justify-center space-y-4 bg-[var(--page)] text-[var(--ink)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2d7b4e]/20 border-t-[#2d7b4e]" />
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Validating session...</p>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-screen overflow-x-hidden bg-[var(--page)] text-[var(--ink)] antialiased selection:bg-[#b7e33d]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_70%_10%,rgba(183,227,61,0.16),transparent_27%),radial-gradient(circle_at_28%_80%,rgba(45,123,78,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_70%_10%,rgba(183,227,61,0.08),transparent_27%),radial-gradient(circle_at_28%_80%,rgba(45,123,78,0.14),transparent_30%)]" />
      <Sidebar
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        transcriptions={filteredTranscriptions}
        selectedTrackId={selectedTrackId}
        onSelectTrack={handleSelectTrack}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        user={user}
        logout={logout}
        loginWithGoogle={loginWithGoogle}
      />

      <div className={`relative z-10 flex min-h-screen flex-1 flex-col transition-[padding] duration-300 ${isMenuOpen ? "md:pl-[18.5rem]" : "md:pl-[5.25rem]"}`}>
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-2.5 text-[var(--ink)] transition hover:border-[var(--line-strong)] md:hidden" aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></button>
              <div className="hidden h-8 w-px bg-[var(--line)] md:block" />
              <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]"><AudioWaveform className="h-3.5 w-3.5 text-[var(--accent-strong)]" /> Notation desk</div><div className="mt-0.5 truncate text-sm font-semibold text-[var(--ink)]">{currentTitle || (activeTab === "settings" ? "Workspace settings" : "New score")}</div></div>
            </div>
            <div className="flex items-center gap-2.5"><button type="button" onClick={toggleTheme} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-2.5 text-[var(--ink)] transition hover:border-[var(--accent-strong)]" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>{status === "completed" && <span className="hidden items-center gap-1.5 rounded-full border border-[#2d7b4e]/20 bg-[#e9f4c6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2d7b4e] dark:border-[#b7e33d]/20 dark:bg-[#b7e33d]/10 dark:text-[#dff69a] sm:flex"><CircleCheck className="h-3.5 w-3.5" /> Ready</span>}{user?.isAnonymous ? <button onClick={loginWithGoogle} className="inline-flex items-center gap-2 rounded-xl bg-[#173b29] px-3.5 py-2.5 text-sm font-semibold text-[#e9f4c6] shadow-lg shadow-[#173023]/15 transition hover:bg-[#2d7b4e] active:scale-[0.98] dark:bg-[#b7e33d] dark:text-[#173023] dark:hover:bg-[#c9f06a]" title="Sign In with Google to save history across devices"><LogIn className="h-4 w-4" /> Sign in</button> : <div className="h-8 w-8 rounded-full border border-[var(--line)] bg-[var(--paper)]" aria-hidden="true" />}</div>
          </div>
        </header>

        <section className="relative flex-1 px-5 py-8 md:px-8 md:py-10"><div className="studio-grid pointer-events-none absolute inset-0 opacity-70" /><div className="relative mx-auto flex min-h-[calc(100vh-150px)] max-w-[1480px] flex-col">
          {status === 'processing' ? <div className="flex flex-1 items-center justify-center"><ProcessingView step={processingStep} /></div> : <>
            {activeTab === 'dashboard' && (
              status === 'completed' && currentSheetMusic ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-7 flex flex-col gap-5 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2d7b4e] dark:text-[#b7e33d]"><Sparkles className="h-3.5 w-3.5" /> Transcription complete</div><h1 className="truncate display-type text-3xl font-black tracking-[-0.055em] text-[var(--ink)] md:text-5xl">{currentTitle || "Notation output"}</h1><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><CircleCheck className="h-4 w-4 text-[#2d7b4e]" /> Ready to review, download, and play.</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={handleDownloadPdf} className="inline-flex items-center gap-2 rounded-xl bg-[#173b29] px-4 py-2.5 text-sm font-semibold text-[#e9f4c6] shadow-lg shadow-[#173023]/15 transition hover:bg-[#2d7b4e] active:scale-[0.98] dark:bg-[#b7e33d] dark:text-[#173023]" title="Download sheet music as PDF"><Download className="h-4 w-4" /> PDF</button><button onClick={handleDownloadMidi} disabled={!currentMidiBase64 && !currentMidiUrl} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--paper)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[#2d7b4e] hover:bg-[#e9f4c6] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#b7e33d]/10" title={currentMidiBase64 || currentMidiUrl ? "Download MIDI file" : "MIDI not available"}><FileMusic className="h-4 w-4" /> MIDI</button><button onClick={handleResetWorkspace} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-2.5 text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--ink)]" title="Close result" aria-label="Close result"><X className="h-5 w-5" /></button></div></div>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_270px]"><div className="paper-grain min-w-0 rounded-[26px] border border-[var(--line)] bg-[var(--paper)] p-3 shadow-[0_24px_70px_rgba(23,48,35,0.10)] md:p-5"><div className="mb-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]"><span>Score preview</span><span className="text-[#2d7b4e] dark:text-[#b7e33d]">MusicXML render</span></div><div className="min-h-[560px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[#f4f4ed] p-2 shadow-inner md:p-4"><SheetMusicViewer musicXmlData={currentSheetMusic} /></div></div><aside className="h-fit rounded-[26px] bg-[#173b29] p-5 text-emerald-50 shadow-xl shadow-[#173023]/15 dark:bg-[#102419]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/55">Project notes</p><h2 className="mt-2 break-words text-lg font-semibold text-white">{currentTitle || "Untitled score"}</h2></div><div className="rounded-xl bg-[#b7e33d] p-2 text-[#173023]"><FileMusic className="h-4 w-4" /></div></div><div className="my-5 h-px bg-white/10" /><div className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-emerald-100/50">Status</span><span className="text-[#dff69a]">Ready</span></div><div className="flex items-center justify-between"><span className="text-emerald-100/50">Layout</span><span className="text-emerald-50">Grand staff</span></div><div className="flex items-center justify-between"><span className="text-emerald-100/50">Exports</span><span className="text-emerald-50">PDF · MIDI</span></div></div><div className="mt-6 rounded-2xl border border-[#b7e33d]/25 bg-[#b7e33d]/10 p-4"><p className="text-xs font-semibold text-[#e9f4c6]">A score worth sitting with.</p><p className="mt-1.5 text-xs leading-5 text-emerald-100/60">The notation is rendered from your transcription data, ready for a closer read.</p></div></aside></div>
                </div>
              ) : status === 'failed' ? <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center py-10"><div className="w-full rounded-[28px] border border-rose-300/35 bg-rose-50 p-7 text-center shadow-xl shadow-rose-900/5 dark:border-rose-300/20 dark:bg-rose-950/20"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"><X className="h-5 w-5" /></div><h1 className="mt-5 text-xl font-bold text-[#173023] dark:text-white">That transcription did not finish</h1><p className="mt-2 text-sm leading-6 text-rose-800/75 dark:text-rose-200/70">{error || "Something went wrong while preparing the score."}</p><button onClick={handleResetWorkspace} className="mt-6 rounded-xl bg-[#173b29] px-4 py-2.5 text-sm font-semibold text-[#e9f4c6] transition hover:bg-[#2d7b4e]">Start again</button></div></div> : <div className="flex flex-1 items-center justify-center py-10 md:py-16"><div className="w-full max-w-2xl"><div className="paper-grain rounded-[30px] border border-[var(--line)] bg-[var(--paper)] p-3 shadow-[0_24px_70px_rgba(23,48,35,0.10)] md:p-4"><div className="rounded-[24px] border border-[var(--line)] bg-[var(--page)] px-5 py-10 text-center md:px-12 md:py-14"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173b29] text-[#b7e33d] shadow-lg shadow-[#173023]/15"><AudioWaveform className="h-7 w-7" /></div><h1 className="display-type mt-7 text-4xl font-bold tracking-[-0.045em] text-[var(--ink)] md:text-5xl">Start a new score</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)] md:text-base">Choose an audio file and give the transcription a name. Your score will appear here when it is ready.</p><div className="mx-auto mt-8 max-w-xl text-left"><AudioUploader onTranscribe={async (file, title) => { setSelectedFile(file); await handleUpload(file, title); }} /></div><div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]"><span>MP3 · WAV · M4A</span><span className="hidden h-1 w-1 rounded-full bg-[#b7e33d] sm:block" /><span>Up to 5MB</span><span className="hidden h-1 w-1 rounded-full bg-[#b7e33d] sm:block" /><span>Private by default</span></div></div></div></div></div>
            )}

            {activeTab === 'settings' && <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[0_24px_70px_rgba(23,48,35,0.08)] md:p-8"><div className="mb-8 flex items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#2d7b4e] dark:text-[#b7e33d]"><Settings className="h-3.5 w-3.5" /> Preferences</div><h2 className="text-2xl font-black tracking-[-0.04em] text-[var(--ink)]">Workspace settings</h2><p className="mt-2 text-sm text-[var(--muted)]">Tune the desk to feel like yours.</p></div></div><div className="space-y-4"><div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-4"><div><div className="text-sm font-semibold text-[var(--ink)]">Theme</div><div className="mt-1 text-xs text-[var(--muted)]">Light is the Harmoniq default; dark remains available.</div></div><button type="button" onClick={toggleTheme} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[#2d7b4e]">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{theme === "dark" ? "Dark" : "Light"}</button></div><div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-4"><div><div className="text-sm font-semibold text-[var(--ink)]">Account</div><div className="mt-1 text-xs text-[var(--muted)]">End your current session.</div></div><button type="button" onClick={() => { if (confirm("Log out of your session?")) void logout(); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">Log out</button></div></div></div>}
          </>}
        </div></section>
      </div>
    </main>
  );
}
