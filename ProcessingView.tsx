'use client';
import { useEffect, useState } from 'react';

const pipeline = ['Reading Audio', 'Analyzing Pitches', 'Quantizing', 'Generating Score'];

export default function ProcessingView() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] space-y-16 animate-in fade-in zoom-in duration-500">
      <div className="relative w-56 h-56">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
        <svg className="w-full h-full transform -rotate-90 relative z-10">
          <circle cx="112" cy="112" r="108" stroke="currentColor" strokeWidth="6" fill="transparent" 
            strokeDasharray={680} strokeDashoffset={680 - (680 * (activeStep + 1)) / 4}
            className="text-emerald-500 transition-all duration-1000 ease-in-out shadow-2xl"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black text-white tracking-tighter">{((activeStep + 1) * 25)}%</span>
        </div>
      </div>

      <div className="flex items-center gap-10">
        {pipeline.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-4 group">
            <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${i <= activeStep ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`} />
            <span className={`text-[10px] uppercase font-bold tracking-[0.2em] transition-colors duration-500 ${i === activeStep ? 'text-emerald-400' : i < activeStep ? 'text-zinc-400' : 'text-zinc-700'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
