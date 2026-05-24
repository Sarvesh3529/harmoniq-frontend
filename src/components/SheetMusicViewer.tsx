"use client";

import React, { useEffect, useRef, useState } from "react";

interface SheetMusicViewerProps {
  musicXmlData: string;
  zoom?: number;
}

export default function SheetMusicViewer({ musicXmlData, zoom = 1.0 }: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !containerRef.current || !musicXmlData) return;

    let osmdInstance: any = null;

    const initOpenSheetMusicDisplay = async () => {
      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        
        if (!containerRef.current) return;
        
        containerRef.current.innerHTML = "";
        
        osmdInstance = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawingParameters: "default", // Tells the engine to show all tracks/staves naturally
          drawTitle: false,
          drawSubtitle: false,
          drawCredits: false,
          drawFromMeasureNumber: 1,
        });

        osmdRef.current = osmdInstance;

        await osmdInstance.load(musicXmlData);
        osmdInstance.Zoom = zoom;
        osmdInstance.render();
        setError(null);
      } catch (err: any) {
        console.error("OSMD initialization or rendering failed:", err);
        setError("Could not parse sheet music configuration data structural properties.");
      }
    };

    initOpenSheetMusicDisplay();

    return () => {
      if (osmdInstance && containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [isClient, musicXmlData]);

  useEffect(() => {
    if (osmdRef.current && !error) {
      try {
        osmdRef.current.Zoom = zoom;
        osmdRef.current.render();
      } catch (err) {
        console.error("Failed to update layout zoom parameters:", err);
      }
    }
  }, [zoom, error]);

  if (!isClient) {
    return (
      <div className="w-full h-[450px] bg-white/[0.01] rounded-xl animate-pulse flex items-center justify-center text-xs text-slate-500">
        Preparing rendering engine framework...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-2 relative">
      {error && (
        <p className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full min-h-[450px] max-h-[65vh] overflow-x-auto overflow-y-auto bg-white p-6 rounded-xl border border-slate-800 shadow-inner sheet-music-container"
        style={{ color: "#000000" }}
      />
    </div>
  );
}