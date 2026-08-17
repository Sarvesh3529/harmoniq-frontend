"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { db } from "../lib/firebase";
import AudioUploader from '../components/AudioUploader';
import SheetMusicViewer from "../components/SheetMusicViewer";
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
  FileMusic
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
      {/* Mobile backdrop (tap to close) */}
      {isMenuOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 h-full bg-white dark:bg-[#040407] border-r border-slate-200 dark:border-purple-500/5 flex flex-col justify-between py-6 z-50 transition-all duration-300 ease-in-out",
          // Mobile: slide-in drawer
          "w-72 px-4 -translate-x-full md:translate-x-0",
          isMenuOpen ? "translate-x-0" : "",
          // Desktop: collapsible sidebar
          isMenuOpen ? "md:w-64 md:px-4" : "md:w-20 md:px-2",
        ].join(" ")}
      >
        <div className="flex flex-col gap-6 w-full h-[calc(100%-110px)]">
        {/* Header Section */}
        <div className="h-24 flex items-center justify-between w-full relative border-b border-white/[0.02] pb-2">
          {isMenuOpen ? (
            <>
              {/* LOGO SIZING NUDGE ZONE (logo-with-name):
                  - Size: tweak `w-[70%]`.
                  - Left nudge: tweak `ml-[12%]` (smaller = more left).
               */}
              <div className="flex items-center w-full h-full overflow-hidden">
                <img
                  src="/logo-with-name.png"
                  alt="Harmoniq"
                  className="w-[70%] h-auto ml-[12%] mr-auto object-contain max-w-none"
                />
              </div>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5 rounded-lg transition-all z-50"
                title="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="relative group flex items-center justify-center w-full">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="focus:outline-none transition-transform active:scale-95 flex items-center justify-center w-full"
                title="Open sidebar"
              >
                {/* GEMINI-STYLE MENU BUTTON (no logo):
                    - Button size: tweak `w-14 h-14`.
                    - Icon size: tweak `w-6 h-6`.
                 */}
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                  <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-2 w-full">
          <button
            disabled={status === 'processing'}
            onClick={() => setActiveTab("dashboard")}
            className={`p-3 rounded-xl flex items-center gap-4 transition-all w-full ${activeTab === "dashboard" && !selectedTrackId
              ? "bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0 mx-auto" />
            {isMenuOpen && <span className="text-sm font-medium">Workspace</span>}
          </button>

          {isMenuOpen ? (
            <div className="w-full px-1 animate-fade-in">
              <div className="relative flex items-center bg-white/[0.02] border border-white/5 rounded-xl w-full px-3 py-2">
                <Search className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tracks..."
                  className="bg-transparent text-sm text-slate-200 w-full focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-3 rounded-xl flex items-center transition-all w-full text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              <Search className="w-5 h-5 flex-shrink-0 mx-auto" />
            </button>
          )}
        </nav>

        {/* History Item Section */}
        {isMenuOpen && (
          <div className="flex-1 overflow-y-auto px-1 mt-2 space-y-2 max-h-[50vh] animate-fade-in scrollbar-thin">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-600 px-1 mb-1">History</p>
            {transcriptions.length === 0 ? (
              <p className="text-xs text-slate-500 px-1 italic">No records found</p>
            ) : (
              <div className="flex flex-col gap-1">
                {transcriptions.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => onSelectTrack(track)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 group border ${selectedTrackId === track.id
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                      : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                      }`}
                  >
                    <FileAudio className={`w-4 h-4 flex-shrink-0 ${selectedTrackId === track.id ? "text-purple-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{track.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {track.createdAt ? new Date(track.createdAt).toLocaleDateString() : "Recent"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="flex flex-col gap-3 w-full">
        <button
          disabled={status === 'processing'}
          onClick={() => setActiveTab("settings")}
          className={`p-3 rounded-xl flex items-center gap-4 transition-all w-full ${activeTab === "settings"
            ? "bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Settings className="w-5 h-5 flex-shrink-0 mx-auto" />
          {isMenuOpen && <span className="text-sm font-medium">Settings</span>}
        </button>

        <div
          onClick={() => {
            if (user?.isAnonymous) {
              loginWithGoogle();
            } else {
              if (confirm("Sign out of your session?")) logout();
            }
          }}
          className="flex items-center gap-4 p-2 w-full cursor-pointer hover:bg-red-500/5 rounded-xl transition-all group"
          title={user?.isAnonymous ? "Click to sign in" : "Click to sign out"}
        >
          <div
            className={`h-9 w-9 rounded-full border border-purple-500/30 bg-purple-600/10 flex-shrink-0 overflow-hidden ${isMenuOpen ? "" : "mx-auto"
              }`}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user?.displayName ? `${user.displayName} avatar` : "Avatar"}
                className="h-9 w-9 rounded-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-purple-500 dark:text-purple-400">
                {user?.isAnonymous ? "G" : (user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U")}
              </div>
            )}
          </div>
          {isMenuOpen && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-red-500 dark:group-hover:text-red-400">
                {user?.isAnonymous ? "Guest User" : (user?.displayName || "User")}
              </span>
              <span className="text-[10px] text-slate-500 truncate group-hover:text-red-600/70 dark:group-hover:text-red-500/70">
                {user?.isAnonymous ? "Sign in to save runs" : "Sign out"}
              </span>
            </div>
          )}
        </div>
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
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 max-w-md mx-auto relative z-20">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
        <Music className="w-6 h-6 text-purple-400 absolute animate-pulse" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-slate-200">Processing Audio</h3>
        <p className="text-sm text-slate-400 min-h-[20px] transition-all">{steps[step] || "Working..."}</p>
      </div>
    </div>
  );
};

const ScoreViewer: React.FC<{ sheetMusicData?: string | null }> = ({ sheetMusicData }) => (
  <div className="w-full bg-[#030712]/60 p-4 rounded-xl border border-slate-900/60 min-h-[520px] flex flex-col items-center justify-center overflow-hidden">
    {sheetMusicData ? (
      <SheetMusicViewer musicXmlData={sheetMusicData} />
    ) : (
      <p className="text-sm text-slate-500 font-mono">No sheet music structural output loaded.</p>
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

  // Ref to the rendered sheet music container for PDF export
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);

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
    const container = sheetContainerRef.current;
    if (!container) return;

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      const safeName = (currentTitle || "transcription").replace(/[^a-z0-9_\-. ]/gi, "_");
      pdf.save(`${safeName}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  }, [currentTitle]);

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
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#02040a] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
        <p className="text-xs text-slate-500 tracking-wider uppercase font-medium">Validating Session...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-screen bg-slate-50 text-slate-900 dark:bg-[#02040a] dark:text-slate-100 selection:bg-purple-500/30 overflow-x-hidden antialiased flex relative">
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[720px] h-[400px] bg-gradient-to-tr from-purple-600/20 via-violet-500/10 to-transparent blur-[140px] pointer-events-none z-0 rounded-full animate-pulse duration-[8000ms]" />

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

      <div
        className={`flex-1 min-h-screen flex flex-col relative z-10 w-full transition-all duration-300 ease-in-out pl-0 ${
          isMenuOpen ? "md:pl-64" : "md:pl-20"
        }`}
      >
        <header className="w-full px-6 md:px-12 py-6 flex justify-between items-center z-40 bg-transparent">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 md:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold opacity-80">
            Workspace
          </div>
          <div>
            {user?.isAnonymous ? (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-sm font-semibold shadow shadow-purple-950/20 transition-all"
                title="Sign In with Google to save history across devices"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            ) : (
              <div />
            )}
          </div>
        </header>

        <section className="flex-1 w-full flex flex-col items-center justify-center px-6 md:px-12 pb-24 pt-12 relative z-10">
          {status === 'processing' ? (
            <ProcessingView step={processingStep} />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="w-full max-w-3xl flex flex-col items-center justify-center space-y-12">
                  {status === 'completed' && currentSheetMusic ? (
                    <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/60 pb-4">
                        <div>
                          <h2 className="text-xl font-bold tracking-tight text-white">
                            {currentTitle ? currentTitle : "Notation Output"}
                          </h2>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Download PDF */}
                          <button
                            onClick={handleDownloadPdf}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold shadow shadow-indigo-800/30 transition-all"
                            title="Download sheet music as PDF"
                          >
                            <Download className="w-4 h-4" />
                            Download PDF
                          </button>
                          {/* Download MIDI */}
                          <button
                            onClick={handleDownloadMidi}
                            disabled={!currentMidiBase64 && !currentMidiUrl}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 active:scale-95 text-purple-300 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            title={currentMidiBase64 || currentMidiUrl ? "Download MIDI file" : "MIDI not available"}
                          >
                            <FileMusic className="w-4 h-4" />
                            Download MIDI
                          </button>
                          {/* Reset */}
                          <button
                            onClick={handleResetWorkspace}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            title="Close result"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Sheet music viewer — ref used for PDF capture */}
                      <div
                        ref={sheetContainerRef}
                        className="w-full bg-[#030712]/60 p-4 rounded-xl border border-slate-900/60 min-h-[520px] flex flex-col items-center justify-center overflow-hidden"
                      >
                        <SheetMusicViewer musicXmlData={currentSheetMusic} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-8 flex flex-col items-center text-center">
                      <div className="space-y-3">
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white max-w-xl">
                          What would you like to transcribe?
                        </h1>
                      </div>

                      <AudioUploader
                        onTranscribe={async (file, title) => {
                          setSelectedFile(file);
                          await handleUpload(file, title);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="w-full max-w-2xl bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/5 rounded-2xl p-6 md:p-8 space-y-8">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Workspace Settings</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Personalize your experience.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Theme</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Switch between light and dark.</div>
                      </div>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 text-sm font-medium"
                        aria-label="Toggle theme"
                      >
                        {theme === "dark" ? "Dark" : "Light"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">End your current session.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Log out of your session?")) void logout();
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm font-semibold"
                      >
                        Log Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
