import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PDF_MARGIN_MM = 12;
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;

function safeFileName(name: string): string {
  const normalized = name.replace(/[^a-z0-9_\-. ]/gi, "_").trim();
  return normalized || "transcription";
}

function expandSheetMusicClone(root: HTMLElement): void {
  root.style.maxHeight = "none";
  root.style.height = "auto";
  root.style.overflow = "visible";
  root.style.width = `${Math.max(root.scrollWidth, root.clientWidth)}px`;

  const scrollRegions = root.querySelectorAll<HTMLElement>(
    "[data-sheet-music-scroll], .sheet-music-container"
  );
  scrollRegions.forEach((region) => {
    region.style.maxHeight = "none";
    region.style.height = "auto";
    region.style.minHeight = "0";
    region.style.overflow = "visible";
  });
}

/**
 * Capture the complete rendered score, including content below the viewer's
 * scroll viewport, and paginate it into a normal A4 PDF.
 */
export async function downloadFullDocumentPdf(
  element: HTMLElement,
  title: string,
): Promise<void> {
  const marker = `pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  element.dataset.pdfExportMarker = marker;

  try {
    const captureWidth = Math.max(element.scrollWidth, element.clientWidth, 1);
    const captureHeight = Math.max(element.scrollHeight, element.clientHeight, 1);
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (documentClone) => {
        const clonedRoot = documentClone.querySelector<HTMLElement>(
          `[data-pdf-export-marker="${marker}"]`,
        );
        if (clonedRoot) {
          expandSheetMusicClone(clonedRoot);
        }
      },
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("The rendered sheet music has no printable dimensions.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const contentWidth = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
    const contentHeight = PDF_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
    const pageImageHeight = contentWidth * (canvas.height / canvas.width);
    const sourceSliceHeight = Math.max(
      1,
      Math.floor(canvas.width * (contentHeight / pageImageHeight)),
    );

    let sourceY = 0;
    let pageNumber = 0;
    while (sourceY < canvas.height) {
      if (pageNumber > 0) {
        pdf.addPage("a4", "portrait");
      }

      const sliceHeight = Math.min(sourceSliceHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      if (!context) {
        throw new Error("Could not create a PDF page canvas.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height,
      );

      const renderedHeight = contentWidth * (sliceHeight / canvas.width);
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        PDF_MARGIN_MM,
        PDF_MARGIN_MM,
        contentWidth,
        Math.min(renderedHeight, contentHeight),
        undefined,
        "FAST",
      );
      sourceY += sliceHeight;
      pageNumber += 1;
    }

    pdf.save(`${safeFileName(title)}.pdf`);
  } finally {
    delete element.dataset.pdfExportMarker;
  }
}
