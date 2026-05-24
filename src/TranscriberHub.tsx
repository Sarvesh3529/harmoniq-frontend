'use client';
import { useState } from 'react';
import { Upload, Mic, Piano, Guitar, Waves, ChevronRight } from 'lucide-react';

export default function TranscriberHub({ onProcess }: { onProcess: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [instrument, setInstrument] = useState('piano');

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div 
        className={`relative h-96 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center gap-6 overflow-hidden
        ${isRecording ? 'border-emerald-500/50 bg-emerald-500/[0.02] shadow-[0_0_50px_rgba(16,185,129,0.05)]' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40 cursor-pointer'}`}
      >
        {!isRecording ? (
          <>
            <div className="w-20 h-20 rounded-3xl bg-zinc-800/50 flex items-center justify-center ring-1 ring-zinc-700 group-hover:scale-105 transition-transform">
              <Upload className="text-zinc-400" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h2 className="text-white text-lg font-semibold tracking-tight">Import Audio Artifact</h2>
              <p className="text-zinc-500 text-sm mt-1">WAV, MP3, M4A up to 50MB</p>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
              <div className="relative w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                <Mic className="text-white" size={36} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-emerald-500 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Capturing Frequency Data</p>
              <div className="flex gap-1 justify-center">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 h-4 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </>
        )}

        <button 
          onClick={(e) => { e.stopPropagation(); setIsRecording(!isRecording); }}
          className="absolute bottom-8 right-8 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
        >
          <Mic size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <div className="space-y-3">
            <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest ml-1">Target Instrument</span>
            <div className="flex gap-2">
              <button onClick={() => setInstrument('piano')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${instrument === 'piano' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                <Piano size={14} /> Piano
              </button>
              <button onClick={() => setInstrument('solo')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${instrument === 'solo' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                <Waves size={14} /> Solo
              </button>
            </div>
          </div>

          <div className="w-[1px] h-12 bg-zinc-800 mx-2" />

          <div className="space-y-3">
            <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest ml-1">Quantization</span>
            <select className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer hover:text-emerald-400 transition-colors uppercase tracking-tight">
              <option>Strict (Engine)</option>
              <option>Fluid (Natural)</option>
            </select>
          </div>
        </div>

        <button onClick={onProcess} className="group flex items-center gap-3 px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-2xl font-black uppercase tracking-tighter transition-all active:scale-95 shadow-xl shadow-emerald-500/10">
          Transcribe <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
