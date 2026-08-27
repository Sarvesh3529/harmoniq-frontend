import jsPDF from "jspdf";
import { svg2pdf } from "svg2pdf.js";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const TEMPO_FONT_SIZE_PT = 14;

type OsmdPageBackend = {
  getSvgElement?: () => SVGSVGElement | null;
};

type OsmdForExport = {
  drawer?: {
    Backends?: OsmdPageBackend[];
  };
  load: (content: string) => Promise<unknown>;
  render: () => void;
  clear?: () => void;
};

type TempoAnnotation = {
  text: string;
  x: number;
  y: number;
};

function safeFileName(name: string): string {
  const normalized = name.replace(/[^a-z0-9_\-. ]/gi, "_").trim();
  return normalized || "transcription";
}

function waitForRenderFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function getRenderedSvgPages(host: HTMLElement, osmd: OsmdForExport): SVGSVGElement[] {
  const backendPages = osmd.drawer?.Backends ?? [];
  const fromBackends = backendPages
    .map((backend) => backend.getSvgElement?.() ?? null)
    .filter((element): element is SVGSVGElement => element !== null);

  if (fromBackends.length > 0) {
    return fromBackends;
  }

  return Array.from(host.querySelectorAll<SVGSVGElement>('svg[id^="osmdSvgPage"]'));
}

function getTempoAnnotations(page: SVGSVGElement): TempoAnnotation[] {
  return Array.from(page.querySelectorAll<SVGTextElement>("text"))
    .map((node) => {
      const rawText = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const x = Number.parseFloat(node.getAttribute("x") ?? "");
      const y = Number.parseFloat(node.getAttribute("y") ?? "");

      if (!rawText.startsWith("=") || !Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { text: rawText, x, y };
    })
    .filter((annotation): annotation is TempoAnnotation => annotation !== null);
}

function removeTempoTextNodes(page: SVGSVGElement): TempoAnnotation[] {
  const tempoAnnotations = getTempoAnnotations(page);
  if (tempoAnnotations.length === 0) {
    return [];
  }

  page.querySelectorAll<SVGTextElement>("text").forEach((node) => {
    const rawText = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (rawText.startsWith("=")) {
      node.textContent = "";
    }
  });

  return tempoAnnotations;
}

function drawTempoAnnotations(
  pdf: jsPDF,
  page: SVGSVGElement,
  tempoAnnotations: TempoAnnotation[],
): void {
  if (tempoAnnotations.length === 0) {
    return;
  }

  const svgWidth = Number.parseFloat(page.getAttribute("width") ?? "");
  const svgHeight = Number.parseFloat(page.getAttribute("height") ?? "");
  if (!Number.isFinite(svgWidth) || !Number.isFinite(svgHeight) || svgWidth <= 0 || svgHeight <= 0) {
    return;
  }

  pdf.setFont("times", "normal");
  pdf.setFontSize(TEMPO_FONT_SIZE_PT);
  pdf.setTextColor(0, 0, 0);

  const scaleX = A4_WIDTH_MM / svgWidth;
  const scaleY = A4_HEIGHT_MM / svgHeight;
  tempoAnnotations.forEach(({ text, x, y }) => {
    pdf.text(text, x * scaleX, y * scaleY);
  });
}

/**
 * Render the MusicXML in clean, fixed A4 OSMD instances and export each OSMD
 * SVG page directly to PDF. This deliberately does not capture the UI scroll
 * container: OSMD's drawer owns the complete page list, so no systems can be
 * clipped by CSS overflow or rasterized at an arbitrary viewport size.
 *
 * Default engraving is preferred. If it would strand a short final page, the
 * exporter tries OSMD's less-tight compact profile, then compacttight only if
 * necessary, and chooses the layout with the fewest pages. This keeps short
 * scores balanced without forcing compact spacing on every score.
 *
 * OSMD's tempo text is present in the SVG but is not reliably painted by
 * svg2pdf.js. Tempo text nodes are therefore removed before conversion and
 * redrawn as PDF text at their original SVG coordinates.
 */
export async function downloadFullDocumentPdf(
  musicXmlData: string,
  title: string,
  preprocess?: (xml: string) => string,
): Promise<void> {
  if (typeof window === "undefined" || !musicXmlData.trim()) {
    throw new Error("Sheet music is not available for PDF export.");
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    "width:794px",
    "min-height:1123px",
    "overflow:visible",
    "background:#ffffff",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(host);

  let osmd: OsmdForExport | null = null;

  try {
    const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
    const processedXml = preprocess ? preprocess(musicXmlData) : musicXmlData;
    type ExportLayout = "default" | "compact" | "compacttight";

    const renderPages = async (drawingParameters: ExportLayout): Promise<SVGSVGElement[]> => {
      osmd?.clear?.();
      host.innerHTML = "";
      osmd = new OpenSheetMusicDisplay(host, {
        autoResize: false,
        backend: "svg",
        alignRests: 2,
        pageFormat: "A4_P",
        drawingParameters,
        drawTitle: false,
        drawSubtitle: false,
        drawCredits: false,
        renderSingleHorizontalStaffline: false,
      }) as unknown as OsmdForExport;

      await osmd.load(processedXml);
      osmd.render();
      await waitForRenderFrame();
      return getRenderedSvgPages(host, osmd);
    };

    let selectedLayout: ExportLayout = "default";
    let bestPageCount = Number.POSITIVE_INFINITY;
    for (const layout of ["default", "compact", "compacttight"] as const) {
      if (layout !== "default" && bestPageCount <= 1) {
        break;
      }
      const candidatePages = await renderPages(layout);
      if (candidatePages.length === 0) {
        throw new Error("OSMD did not render any printable score pages.");
      }
      if (candidatePages.length < bestPageCount) {
        bestPageCount = candidatePages.length;
        selectedLayout = layout;
      }
    }

    const pages = await renderPages(selectedLayout);
    if (pages.length === 0) {
      throw new Error("OSMD did not render any printable score pages.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [A4_WIDTH_MM, A4_HEIGHT_MM],
      compress: true,
    });

    for (const [index, page] of pages.entries()) {
      if (index > 0) {
        pdf.addPage([A4_WIDTH_MM, A4_HEIGHT_MM], "portrait");
      }

      page.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const tempoAnnotations = removeTempoTextNodes(page);
      await svg2pdf(page, pdf, {
        x: 0,
        y: 0,
        width: A4_WIDTH_MM,
        height: A4_HEIGHT_MM,
      });
      drawTempoAnnotations(pdf, page, tempoAnnotations);
    }

    pdf.save(`${safeFileName(title)}.pdf`);
  } finally {
    host.remove();
  }
}
