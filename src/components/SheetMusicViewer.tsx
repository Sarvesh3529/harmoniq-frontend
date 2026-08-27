"use client";

import React, { useEffect, useRef, useState } from "react";

interface SheetMusicViewerProps {
  musicXmlData: string;
  zoom?: number;
}

// MIDI pitch for each note name (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
const STEP_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Pre-processes a MusicXML string so that:
 *  - The first attributes block always has <staves>2</staves>
 *  - Clef 1 is always Treble (G / line 2) and Clef 2 is always Bass (F / line 4)
 *  - Pitched notes without a valid staff assignment receive a soft pitch-based fallback
 *
 * This ensures OSMD renders the top stave with a Treble clef and the
 * bottom stave with a Bass clef, regardless of what the backend emitted.
 */
export function enforcePianoGrandStaff(xmlString: string): string {
  // Strip xmlns namespace declarations before parsing.
  // music21 (used in the backend) injects xmlns="..." when it re-saves the
  // file.  If we leave it in, elements created with createElementNS(null,...)
  // get serialised with xmlns="" by XMLSerializer — a different namespace from
  // the rest of the document — and OSMD silently ignores them.
  const strippedXml = xmlString.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(strippedXml, 'application/xml');

  if (doc.querySelector('parsererror')) {
    return xmlString; // malformed — let OSMD show its own error
  }

  // Use the document's own namespace (null if none) for all created elements.
  const docNs = doc.documentElement.namespaceURI;
  const ns = (tag: string) => doc.createElementNS(docNs, tag);

  const parts = doc.querySelectorAll("part");
  parts.forEach((part) => {
    const measures = part.querySelectorAll("measure");

    // 1. Fix the first measure's <attributes> block
    const firstMeasure = measures[0];
    if (firstMeasure) {
      let attributes = firstMeasure.querySelector("attributes");
      if (!attributes) {
        attributes = ns("attributes");
        firstMeasure.insertBefore(attributes, firstMeasure.firstChild);
      }

      // Ensure <staves>2</staves>
      let stavesEl = attributes.querySelector("staves");
      if (!stavesEl) {
        stavesEl = ns("staves");
        const refTags = ["divisions", "key", "time"];
        let insertAfter: Element | null = null;
        for (const tag of refTags) {
          const el = attributes.querySelector(tag);
          if (el) insertAfter = el;
        }
        if (insertAfter) {
          insertAfter.after(stavesEl);
        } else {
          attributes.prepend(stavesEl);
        }
      }
      stavesEl.textContent = "2";

      // Remove all existing <clef> elements
      attributes.querySelectorAll("clef").forEach((c) => c.remove());

      // Add Treble clef (staff 1) — G clef, line 2
      const clef1 = ns("clef");
      clef1.setAttribute("number", "1");
      const sign1 = ns("sign"); sign1.textContent = "G";
      const line1 = ns("line"); line1.textContent = "2";
      clef1.appendChild(sign1);
      clef1.appendChild(line1);

      // Add Bass clef (staff 2) — F clef, line 4
      const clef2 = ns("clef");
      clef2.setAttribute("number", "2");
      const sign2 = ns("sign"); sign2.textContent = "F";
      const line2 = ns("line"); line2.textContent = "4";
      clef2.appendChild(sign2);
      clef2.appendChild(line2);

      attributes.appendChild(clef1);
      attributes.appendChild(clef2);
    }

    // 2. Assign each pitched note to the correct staff
    measures.forEach((measure) => {
      measure.querySelectorAll("note").forEach((note) => {
        const pitchEl = note.querySelector("pitch");
        if (!pitchEl) return; // skip rests

        const step = pitchEl.querySelector("step")?.textContent?.trim() ?? "C";
        const octave = parseInt(pitchEl.querySelector("octave")?.textContent ?? "4", 10);
        const alter = parseFloat(pitchEl.querySelector("alter")?.textContent ?? "0");
        const midiPitch = (octave + 1) * 12 + (STEP_SEMITONE[step] ?? 0) + Math.round(alter);

        let staffEl = note.querySelector("staff");
        const existingStaff = staffEl?.textContent?.trim();
        if (existingStaff === "1" || existingStaff === "2") return;

        const staffVal = midiPitch >= 60 ? "1" : "2";
        if (!staffEl) {
          staffEl = ns("staff");
          const beforeTags = ["beam", "notations", "lyrics"];
          let insertBefore: Element | null = null;
          for (const tag of beforeTags) {
            const el = note.querySelector(tag);
            if (el) { insertBefore = el; break; }
          }
          if (insertBefore) {
            note.insertBefore(staffEl, insertBefore);
          } else {
            note.appendChild(staffEl);
          }
        }
        staffEl.textContent = staffVal;
      });
    });
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
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
          alignRests: 2,
          drawingParameters: "default", // Tells the engine to show all tracks/staves naturally
          drawTitle: false,
          drawSubtitle: false,
          drawCredits: false,
          drawFromMeasureNumber: 1,
        });

        osmdRef.current = osmdInstance;

        // Pre-process the XML to enforce treble (top) + bass (bottom) clefs
        const processedXml = enforcePianoGrandStaff(musicXmlData);

        await osmdInstance.load(processedXml);
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