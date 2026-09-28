"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileUp,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  Eye,
  Loader2,
  Lock,
  Bookmark,
  Save,
  Upload,
  Zap,
  ScanText,
  Copy,
  Check,
  FileSpreadsheet,
  Menu,
  X,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { generateSamplePdfBlob } from "@/lib/sample-pdf";

// Types
export interface ToastNotification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export interface PromptDialogState {
  isOpen: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (val: string) => void;
}
export interface CensorBox {
  id: string;
  x: number; // relative fraction (0 to 1)
  y: number; // relative fraction (0 to 1)
  width: number; // relative fraction (0 to 1)
  height: number; // relative fraction (0 to 1)
  pageIndex: number | "all"; // specific page (1-based) or 'all'
  label?: string;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  createdAt: number;
  boxes: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageIndex: number | "all";
    label?: string;
  }[];
}

export interface DoExtractionResult {
  page: number;
  rawText: string;
  doNumber: string;
}

export default function PdfCensorStudio() {
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [fileName, setFileName] = useState<string>("document.pdf");
  const [fileSizeStr, setFileSizeStr] = useState<string>("");

  // Redaction boxes state
  const [censorBoxes, setCensorBoxes] = useState<CensorBox[]>([]);
  const [activeBoxScope, setActiveBoxScope] = useState<"current" | "all">("all");
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [redactionColor, setRedactionColor] = useState<"white" | "black">("white");
  const [redactionMode, setRedactionMode] = useState<"normal" | "isolate_do">("normal");

  // Zoom & view
  const [zoomScale, setZoomScale] = useState<number>(1.5);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Exporting
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>("");
  const [exportQuality, setExportQuality] = useState<"compact" | "balanced" | "max">("balanced");

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [previewBox, setPreviewBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Drag over UI state
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Modern Toast & Modal Dialog States (replacing browser alert/confirm/prompt)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const showToast = useCallback((message: string, type: ToastNotification["type"] = "info") => {
    const id = "toast_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [promptDialog, setPromptDialog] = useState<PromptDialogState>({
    isOpen: false,
    title: "",
    defaultValue: "",
    onConfirm: () => {},
  });
  const [promptInputValue, setPromptInputValue] = useState<string>("");

  // Layout Templates state (persisted in localStorage)
  const [savedTemplates, setSavedTemplates] = useState<LayoutTemplate[]>([]);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pdf_censor_templates");
      if (stored) {
        setSavedTemplates(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load saved templates:", e);
    }
  }, []);

  const saveTemplatesToStorage = (templates: LayoutTemplate[]) => {
    setSavedTemplates(templates);
    try {
      localStorage.setItem("pdf_censor_templates", JSON.stringify(templates));
    } catch (e) {
      console.error("Failed to save templates:", e);
    }
  };

  const handleSaveCurrentAsTemplate = () => {
    if (censorBoxes.length === 0) {
      showToast("Please draw at least one redaction box before saving a template.", "warning");
      return;
    }
    const defaultName = `Template ${savedTemplates.length + 1} (${censorBoxes.length} areas)`;
    setPromptInputValue(defaultName);
    setPromptDialog({
      isOpen: true,
      title: "Save Layout Template",
      message: "Give this redaction template a memorable name to reuse anytime:",
      defaultValue: defaultName,
      placeholder: "e.g. Standard Invoice Mask",
      confirmLabel: "Save Template",
      onConfirm: (templateName: string) => {
        if (!templateName || !templateName.trim()) return;
        const newTemplate: LayoutTemplate = {
          id: "tpl_" + Date.now().toString(36),
          name: templateName.trim(),
          createdAt: Date.now(),
          boxes: censorBoxes.map((b) => ({
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            pageIndex: b.pageIndex,
            label: b.label,
          })),
        };
        const updated = [newTemplate, ...savedTemplates];
        saveTemplatesToStorage(updated);
        showToast(`Template "${templateName.trim()}" saved!`, "success");
      },
    });
  };

  const handleApplyTemplate = (template: LayoutTemplate) => {
    // Generate fresh IDs so each box can be manipulated or deleted
    const clonedBoxes: CensorBox[] = template.boxes.map((b) => ({
      ...b,
      id: "box_" + Math.random().toString(36).substring(2, 9),
    }));
    setCensorBoxes(clonedBoxes);
    setSelectedBoxId(null);
    showToast(`Applied template "${template.name}"`, "info");
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tpl = savedTemplates.find((t) => t.id === id);
    setConfirmDialog({
      isOpen: true,
      title: "Delete Template?",
      message: `Are you sure you want to delete the "${tpl?.name || "selected"}" template?`,
      confirmLabel: "Delete",
      isDestructive: true,
      onConfirm: () => {
        const updated = savedTemplates.filter((t) => t.id !== id);
        saveTemplatesToStorage(updated);
        showToast("Template deleted", "info");
      },
    });
  };

  const handleExportTemplatesFile = () => {
    if (savedTemplates.length === 0) {
      showToast("No templates to export. Save a template first!", "warning");
      return;
    }
    const blob = new Blob([JSON.stringify(savedTemplates, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdf-censor-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Template file exported!", "success");
  };

  const handleImportTemplatesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Merge imported templates avoiding duplicate IDs
          const existingIds = new Set(savedTemplates.map((t) => t.id));
          const toAdd = parsed.filter(
            (t: any) => t && t.name && Array.isArray(t.boxes) && !existingIds.has(t.id)
          );
          const updated = [...toAdd, ...savedTemplates];
          saveTemplatesToStorage(updated);
          showToast(`Successfully imported ${toAdd.length} template(s)!`, "success");
        } else {
          showToast("Invalid template JSON format.", "error");
        }
      } catch (err: any) {
        showToast("Failed to parse template file: " + err.message, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // DO Extraction State
  const [doZoneBox, setDoZoneBox] = useState<CensorBox | null>(null);
  const [isExtractingDo, setIsExtractingDo] = useState<boolean>(false);
  const [doExtractProgress, setDoExtractProgress] = useState<number>(0);
  const [doExtractResults, setDoExtractResults] = useState<DoExtractionResult[]>([]);
  const [showDoModal, setShowDoModal] = useState<boolean>(false);
  const [copiedDoList, setCopiedDoList] = useState<boolean>(false);
  const [doViewMode, setDoViewMode] = useState<"clean" | "all">("clean");

  // Calculate distinct unique DO numbers in order of appearance
  const uniqueDoNumbers = Array.from(
    new Set(
      doExtractResults
        .map((r) => r.doNumber.trim())
        .filter((val) => val && val !== "(Not found)")
    )
  );

  // Mark currently selected box as DO extraction zone
  const handleSetCurrentAsDoZone = (box: CensorBox) => {
    setDoZoneBox(box);
    showToast(`Marked "${box.label || "Selected Area"}" as the DO zone!`, "success");
  };

  // Clear everything on the PDF except the selected DO zone
  const handleToggleIsolateDoMode = (box?: CensorBox) => {
    const target =
      box ||
      doZoneBox ||
      (selectedBoxId ? censorBoxes.find((b) => b.id === selectedBoxId) : null) ||
      censorBoxes[0];
    if (!target) {
      showToast("Please draw or select the DO number area first.", "warning");
      return;
    }
    setDoZoneBox(target);
    setRedactionMode((prev) => (prev === "isolate_do" ? "normal" : "isolate_do"));
    if (redactionMode !== "isolate_do") {
      showToast("Active: Wiping entire page clean while preserving DO!", "info");
    } else {
      showToast("Normal redaction mode restored.", "info");
    }
  };

  // Extract DO numbers across all pages using targeted ROI crop + Tesseract OCR
  const handleBatchExtractDo = async () => {
    if (!pdfDoc) {
      showToast("Please open a PDF first.", "warning");
      return;
    }
    const targetBox = doZoneBox || censorBoxes[0];
    if (!targetBox) {
      showToast("Please draw or select a box over the DO number area first.", "warning");
      return;
    }

    try {
      setIsExtractingDo(true);
      setDoExtractProgress(0);
      setDoExtractResults([]);
      setShowDoModal(true);

      const total = pdfDoc.numPages;
      const results: DoExtractionResult[] = [];

      // Lazy load tesseract
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      
      // Set OCR engine parameters: digits whitelist + line segmentation mode
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789- ",
        tessedit_pageseg_mode: "7" as any, // Treat the image as a single text line
      });

      for (let i = 1; i <= total; i++) {
        setDoExtractProgress(Math.round(((i - 1) / total) * 100));

        const page = await pdfDoc.getPage(i);
        
        // ----------------------------------------------------
        // IMPROVEMENT 1: Direct native digital text extraction
        // ----------------------------------------------------
        let matched = "";
        let raw = "";

        try {
          const textContent = await page.getTextContent();
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const pageWidth = unscaledViewport.width;
          const pageHeight = unscaledViewport.height;

          // Target bounding box in PDF coordinate space
          const boxLeft = targetBox.x * pageWidth;
          const boxRight = (targetBox.x + targetBox.width) * pageWidth;
          const boxTop = targetBox.y * pageHeight;
          const boxBottom = (targetBox.y + targetBox.height) * pageHeight;

          // Find text items lying inside the ROI
          const insideItems: string[] = [];
          for (const item of textContent.items as any[]) {
            if (!item.str) continue;
            // PDF coordinates: [scaleX, skewY, skewX, scaleY, tx, ty] where ty is measured from bottom
            const tx = item.transform[4];
            const ty = pageHeight - item.transform[5]; // convert to top-down coordinates
            
            // Check bounding box overlap with some margin
            if (tx >= boxLeft - 10 && tx <= boxRight + 10 && ty >= boxTop - 10 && ty <= boxBottom + 10) {
              insideItems.push(item.str);
            }
          }

          if (insideItems.length > 0) {
            const combinedZoneText = insideItems.join(" ").trim();
            // Look for 8-digit match in native text
            const m8 = combinedZoneText.match(/\b(8\d{7})\b/) || combinedZoneText.match(/\b(\d{8})\b/);
            if (m8 && m8[1]) {
              matched = m8[1];
              raw = `(Digital PDF) ${combinedZoneText}`;
            } else {
              // Strip non-digits and test
              const digitsOnly = combinedZoneText.replace(/\D/g, "");
              const sub = digitsOnly.match(/(8\d{7})/) || digitsOnly.match(/(\d{8})/);
              if (sub && sub[1]) {
                matched = sub[1];
                raw = `(Digital PDF) ${combinedZoneText}`;
              }
            }
          }
        } catch (e) {
          console.warn("Native text check error:", e);
        }

        // ----------------------------------------------------
        // IMPROVEMENT 2: High-contrast OCR fallback with 0-9 whitelist
        // ----------------------------------------------------
        if (!matched) {
          const scale = 2.0; // Higher DPI for tiny characters
          const viewport = page.getViewport({ scale });

          // Render page to offscreen canvas
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = Math.ceil(viewport.width);
          pageCanvas.height = Math.ceil(viewport.height);
          const ctx = pageCanvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

            await page.render({
              canvasContext: ctx,
              viewport: viewport,
            }).promise;

            // Calculate cropped ROI rectangle
            const cropX = Math.floor(targetBox.x * pageCanvas.width);
            const cropY = Math.floor(targetBox.y * pageCanvas.height);
            const cropW = Math.ceil(targetBox.width * pageCanvas.width);
            const cropH = Math.ceil(targetBox.height * pageCanvas.height);

            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext("2d", { alpha: false });
            if (cropCtx) {
              // Draw only the targeted zone
              cropCtx.drawImage(
                pageCanvas,
                cropX,
                cropY,
                cropW,
                cropH,
                0,
                0,
                cropW,
                cropH
              );

              // Pre-process ROI: grayscale + high-contrast binarization
              const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
              const d = imgData.data;
              for (let p = 0; p < d.length; p += 4) {
                const brightness = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
                // Binarize threshold
                const val = brightness > 150 ? 255 : 0;
                d[p] = val;
                d[p + 1] = val;
                d[p + 2] = val;
              }
              cropCtx.putImageData(imgData, 0, 0);

              // Run targeted OCR with whitelist
              const { data } = await worker.recognize(cropCanvas);
              raw = (data.text || "").trim();

              // Extract 8-digit DO number
              const eightDigitMatch = raw.match(/\b(8\d{7})\b/) || raw.match(/\b(\d{8})\b/);
              if (eightDigitMatch && eightDigitMatch[1]) {
                matched = eightDigitMatch[1];
              } else {
                const digitOnly = raw.replace(/\D/g, "");
                const sub8 = digitOnly.match(/(8\d{7})/) || digitOnly.match(/(\d{8})/);
                if (sub8 && sub8[1]) {
                  matched = sub8[1];
                } else {
                  matched = digitOnly.length >= 8 ? digitOnly.slice(0, 8) : digitOnly;
                }
              }
            }
          }
        }

        results.push({
          page: i,
          rawText: raw,
          doNumber: matched || "(Not found)",
        });

        setDoExtractResults([...results]);
        setDoExtractProgress(Math.round((i / total) * 100));
      }

      await worker.terminate();
      setIsExtractingDo(false);
    } catch (err: any) {
      console.error("DO extraction error:", err);
      showToast("Extraction failed: " + err.message, "error");
      setIsExtractingDo(false);
    }
  };

  const handleCopyDoList = () => {
    // If clean mode, copy ONLY the DO numbers list, e.g.
    // 81544456
    // 81333845
    //
    // total do. : 2
    let textToCopy = "";
    if (doViewMode === "clean") {
      const dos = uniqueDoNumbers.length > 0
        ? uniqueDoNumbers
        : doExtractResults.map((r) => r.doNumber);
      textToCopy = `${dos.join("\n")}\n\ntotal do. : ${dos.length}`;
    } else {
      textToCopy = doExtractResults.map(r => `Page ${r.page}: ${r.doNumber}`).join("\n");
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedDoList(true);
    showToast("Copied DO list to clipboard!", "success");
    setTimeout(() => setCopiedDoList(false), 2000);
  };

  const handleExportDoCsv = () => {
    const rows = [["Page", "Extracted DO Number", "Raw Detected OCR"]];
    doExtractResults.forEach(r => {
      rows.push([String(r.page), `"${r.doNumber.replace(/"/g, '""')}"`, `"${r.rawText.replace(/"/g, '""')}"`]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DO_Numbers_${fileName.replace(/\.pdf$/i, "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Canvas and DOM refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Initialize PDF.js with full CMap and Worker support
  useEffect(() => {
    let isMounted = true;

    async function initPdfEngine() {
      try {
        let pdfjsLib: any = null;

        // Check if loaded globally via script tag
        if (typeof window !== "undefined" && (window as any).pdfjsLib) {
          pdfjsLib = (window as any).pdfjsLib;
        } else {
          // Dynamic import
          pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() =>
            import("pdfjs-dist")
          );
        }

        if (pdfjsLib) {
          const version = "4.10.38";
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
          }
          if (isMounted) {
            setPdfjs(pdfjsLib);
          }
        }
      } catch (err) {
        console.error("Failed to initialize PDF engine:", err);
      }
    }

    initPdfEngine();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter boxes visible on the current page
  const visibleBoxes = censorBoxes.filter(
    (b) => b.pageIndex === "all" || b.pageIndex === currentPage
  );

  // Render current page directly to canvas without distorting transforms (guarantees scanned image bitmaps display)
  const renderPage = useCallback(
    async (pageNum: number, scale: number, doc = pdfDoc) => {
      if (!doc || !canvasRef.current || !pdfjs) return;

      setIsRendering(true);
      setRenderError(null);

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore cancel
          }
        }

        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;

        // 1:1 pixel backing matching the viewport geometry (exactly as in proven standalone HTML)
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);

        canvas.width = width;
        canvas.height = height;

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        if (overlayRef.current) {
          overlayRef.current.style.width = `${width}px`;
          overlayRef.current.style.height = `${height}px`;
        }

        if (pageContainerRef.current) {
          pageContainerRef.current.style.width = `${width}px`;
          pageContainerRef.current.style.height = `${height}px`;
        }

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        // Reset any previous transformations
        context.setTransform(1, 0, 0, 1, 0, 0);

        // Baseline white canvas
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error("Error rendering PDF page:", error);
          setRenderError(
            `Could not render page ${pageNum}: ${error.message || "Decoding error"}`
          );
        }
      } finally {
        setIsRendering(false);
      }
    },
    [pdfDoc, pdfjs]
  );

  // Re-render when page, zoom or document changes
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage, zoomScale);
    }
  }, [pdfDoc, currentPage, zoomScale, renderPage]);

  // Load a PDF file array buffer with full CMap resources for scanned documents
  const loadPdfArrayBuffer = async (
    buffer: ArrayBuffer,
    name: string,
    size?: number
  ) => {
    if (!pdfjs) {
      showToast("PDF engine is initializing. Please wait a moment and try again.", "info");
      return;
    }

    try {
      setIsRendering(true);
      setRenderError(null);

      // Supply CMap parameters essential for scanned PDFs and embedded fonts
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
        cMapPacked: true,
        standardFontDataUrl:
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/",
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setFileName(name);

      if (size) {
        setFileSizeStr(
          size > 1024 * 1024
            ? `${(size / (1024 * 1024)).toFixed(2)} MB`
            : `${(size / 1024).toFixed(1)} KB`
        );
      } else {
        setFileSizeStr("Loaded");
      }

      setCensorBoxes([]);
      setSelectedBoxId(null);
      await renderPage(1, zoomScale, doc);
      showToast(`Loaded "${name}" (${doc.numPages} pages)`, "success");
    } catch (err: any) {
      console.error("Failed to load PDF:", err);
      showToast(`Could not open this PDF: ${err.message || "Invalid or corrupt file."}`, "error");
    } finally {
      setIsRendering(false);
    }
  };

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showToast("Please choose a valid PDF file.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        loadPdfArrayBuffer(reader.result, file.name, file.size);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showToast("Please drop a valid .pdf document.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        loadPdfArrayBuffer(reader.result, file.name, file.size);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load sample confidential document
  const handleLoadSample = async () => {
    try {
      const blob = generateSamplePdfBlob();
      const buffer = await blob.arrayBuffer();
      await loadPdfArrayBuffer(buffer, "sample-medical-invoice.pdf", blob.size);

      // Pre-populate sample boxes
      const sampleBoxes: CensorBox[] = [
        {
          id: "box-" + Math.random().toString(36).substring(2, 9),
          x: 0.065,
          y: 0.165,
          width: 0.45,
          height: 0.08,
          pageIndex: "all",
          label: "Patient Identity (SSN & Name)",
        },
        {
          id: "box-" + Math.random().toString(36).substring(2, 9),
          x: 0.065,
          y: 0.34,
          width: 0.55,
          height: 0.07,
          pageIndex: 1,
          label: "Payment & Account Routing",
        },
        {
          id: "box-" + Math.random().toString(36).substring(2, 9),
          x: 0.065,
          y: 0.635,
          width: 0.38,
          height: 0.085,
          pageIndex: "all",
          label: "Physician & Lab Signature",
        },
      ];
      setCensorBoxes(sampleBoxes);
    } catch (e: any) {
      console.error(e);
      showToast("Error generating sample document", "error");
    }
  };

  // Pointer drawing interactions (calculates relative percentages)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pdfDoc || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setIsDrawing(true);
    setDrawStart({ x, y });
    setPreviewBox({ x, y, w: 0, h: 0 });
    overlayRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(drawStart.x, curX);
    const top = Math.min(drawStart.y, curY);
    const width = Math.abs(curX - drawStart.x);
    const height = Math.abs(curY - drawStart.y);

    setPreviewBox({ x: left, y: top, w: width, h: height });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(drawStart.x, curX);
    const top = Math.min(drawStart.y, curY);
    const width = Math.abs(curX - drawStart.x);
    const height = Math.abs(curY - drawStart.y);

    setIsDrawing(false);
    setDrawStart(null);
    setPreviewBox(null);

    // Ignore tiny jitter clicks
    if (width < 6 || height < 6) {
      return;
    }

    const relBox: CensorBox = {
      id: "box-" + Math.random().toString(36).substring(2, 9),
      x: Number((left / rect.width).toFixed(4)),
      y: Number((top / rect.height).toFixed(4)),
      width: Number((width / rect.width).toFixed(4)),
      height: Number((height / rect.height).toFixed(4)),
      pageIndex: activeBoxScope === "all" ? "all" : currentPage,
      label: `Censor Area #${censorBoxes.length + 1}`,
    };

    setCensorBoxes((prev) => [...prev, relBox]);
    setSelectedBoxId(relBox.id);
  };

  // Delete box
  const handleDeleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCensorBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // Clear all boxes
  const handleClearAll = () => {
    if (censorBoxes.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Remove All Redactions?",
      message: `Are you sure you want to remove all ${censorBoxes.length} censorship boxes? This cannot be undone.`,
      confirmLabel: "Clear All",
      isDestructive: true,
      onConfirm: () => {
        setCensorBoxes([]);
        setSelectedBoxId(null);
        showToast("Removed all redactions", "info");
      },
    });
  };

  // Scope toggle
  const toggleBoxScope = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCensorBoxes((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const newScope = b.pageIndex === "all" ? currentPage : "all";
          return { ...b, pageIndex: newScope };
        }
        return b;
      })
    );
  };

  // Export Sanitized PDF: True pixel-level canvas rasterization + burn-in
  const handleExportSanitizedPdf = async () => {
    if (!pdfDoc || censorBoxes.length === 0) {
      showToast("Please open a PDF and draw at least one censorship box before exporting.", "warning");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText("Preparing high-resolution sanitization pipeline...");

    try {
      let outputPdf: jsPDF | null = null;
      const total = pdfDoc.numPages;

      const qualityConfigs = {
        compact: { scale: 1.3, jpegQuality: 0.72 },
        balanced: { scale: 1.6, jpegQuality: 0.85 },
        max: { scale: 2.0, jpegQuality: 0.95 },
      };
      const { scale: EXPORT_SCALE, jpegQuality } = qualityConfigs[exportQuality];

      for (let i = 1; i <= total; i++) {
        setExportStatusText(
          `Burning redactions into page ${i} of ${total} (${exportQuality.toUpperCase()} preset)...`
        );
        setExportProgress(Math.round(((i - 1) / total) * 100));

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: EXPORT_SCALE });

        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = Math.ceil(viewport.width);
        offscreenCanvas.height = Math.ceil(viewport.height);

        const ctx = offscreenCanvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Could not initialize canvas context.");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

        // Render PDF page raster
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        // Apply redaction according to active mode and color
        const fillHex = redactionColor === "white" ? "#ffffff" : "#000000";
        ctx.fillStyle = fillHex;

        if (redactionMode === "isolate_do") {
          // Isolate DO Mode: delete/clear all contents of the PDF EXCEPT for the DO area
          const target = doZoneBox || censorBoxes[0];
          if (target) {
            const doX = target.x * offscreenCanvas.width;
            const doY = target.y * offscreenCanvas.height;
            const doW = target.width * offscreenCanvas.width;
            const doH = target.height * offscreenCanvas.height;
            const canvasW = offscreenCanvas.width;
            const canvasH = offscreenCanvas.height;

            // 1. Top region above DO box
            ctx.fillRect(0, 0, canvasW, Math.max(0, doY));
            // 2. Bottom region below DO box
            ctx.fillRect(0, Math.min(canvasH, doY + doH), canvasW, Math.max(0, canvasH - (doY + doH)));
            // 3. Left region beside DO box
            ctx.fillRect(0, doY, Math.max(0, doX), doH);
            // 4. Right region beside DO box
            ctx.fillRect(Math.min(canvasW, doX + doW), doY, Math.max(0, canvasW - (doX + doW)), doH);
          }
        } else {
          // Normal Redaction Mode: fill all selected censor boxes
          const pageBoxes = censorBoxes.filter(
            (b) => b.pageIndex === "all" || b.pageIndex === i
          );
          pageBoxes.forEach((box) => {
            ctx.fillRect(
              box.x * offscreenCanvas.width,
              box.y * offscreenCanvas.height,
              box.width * offscreenCanvas.width,
              box.height * offscreenCanvas.height
            );
          });
        }

        // Convert rasterized pixel canvas to JPEG using selected quality
        const pageImgData = offscreenCanvas.toDataURL("image/jpeg", jpegQuality);

        const isLandscape = viewport.width >= viewport.height;
        const ptWidth = viewport.width / EXPORT_SCALE;
        const ptHeight = viewport.height / EXPORT_SCALE;

        if (!outputPdf) {
          outputPdf = new jsPDF({
            orientation: isLandscape ? "landscape" : "portrait",
            unit: "pt",
            format: [ptWidth, ptHeight],
            compress: true,
          });
        } else {
          outputPdf.addPage([ptWidth, ptHeight], isLandscape ? "landscape" : "portrait");
        }

        outputPdf.addImage(
          pageImgData,
          "JPEG",
          0,
          0,
          ptWidth,
          ptHeight,
          undefined,
          "FAST"
        );

        setExportProgress(Math.round((i / total) * 100));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const cleanName = fileName.replace(/\.pdf$/i, "");
      const outputFilename = `${cleanName}_SANITIZED.pdf`;

      setExportStatusText("Finalizing file and triggering download...");
      outputPdf?.save(outputFilename);
      setExportStatusText("Done! Sanitized PDF exported.");

      setTimeout(() => {
        setIsExporting(false);
      }, 1500);
    } catch (err: any) {
      console.error("Export failed:", err);
      showToast(`Export failed: ${err.message}`, "error");
      setIsExporting(false);
    }
  };

  return (
    <div
      className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />

      {/* TOP TOOLBAR */}
      <header className="flex items-center justify-between px-3 md:px-5 h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur z-30 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile Drawer Toggle Button */}
          <button
            onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 focus:outline-none"
            title="Open Redaction & Templates Drawer"
          >
            {isMobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm md:text-base font-bold tracking-tight text-white truncate max-w-[130px] sm:max-w-none">
              PDF Censor Studio
            </span>
          </div>

          <span className="hidden lg:inline-block text-xs text-slate-400 font-mono">
            {fileName}
            {numPages > 0 && ` (${numPages} pgs · ${fileSizeStr})`}
          </span>
        </div>

        {/* Page navigation & Zoom */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {pdfDoc && (
            <>
              <div className="flex items-center bg-slate-800/80 rounded-md border border-slate-700/60 p-0.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRendering}
                  className="p-1 md:p-1.5 hover:bg-slate-700/60 rounded text-slate-300 disabled:opacity-30 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1.5 md:px-2 text-xs font-mono tabular-nums text-slate-200">
                  {currentPage}/{numPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages || isRendering}
                  className="p-1 md:p-1.5 hover:bg-slate-700/60 rounded text-slate-300 disabled:opacity-30 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center bg-slate-800/80 rounded-md border border-slate-700/60 p-0.5">
                <button
                  onClick={() =>
                    setZoomScale((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))
                  }
                  className="p-1 md:p-1.5 hover:bg-slate-700/60 rounded text-slate-300 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
                <span className="px-1 md:px-2 text-[11px] md:text-xs font-mono tabular-nums text-slate-300 min-w-9 md:min-w-12 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() =>
                    setZoomScale((z) => Math.min(2.5, Number((z + 0.2).toFixed(2))))
                  }
                  className="p-1 md:p-1.5 hover:bg-slate-700/60 rounded text-slate-300 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Primary Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors whitespace-nowrap"
          >
            <FileUp className="w-3.5 h-3.5 text-slate-400" />
            <span>Open PDF</span>
          </button>

          {!pdfDoc && (
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/80 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sample</span>
            </button>
          )}

          {/* DO Number Extractor Action */}
          <button
            onClick={handleBatchExtractDo}
            disabled={!pdfDoc || censorBoxes.length === 0 || isExtractingDo}
            title="Batch extract DO numbers from defined box across all pages"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-amber-600/90 hover:bg-amber-500 text-white disabled:opacity-40 disabled:hover:bg-amber-600/90 transition-colors shadow-sm whitespace-nowrap"
          >
            {isExtractingDo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ScanText className="w-3.5 h-3.5 text-amber-100" />
            )}
            <span>Extract DO</span>
          </button>

          {/* Clear Image / Isolate DO Feature */}
          <button
            onClick={() => handleToggleIsolateDoMode()}
            disabled={!pdfDoc || censorBoxes.length === 0}
            title={
              redactionMode === "isolate_do"
                ? "Isolate DO Mode ACTIVE: Everything except DO is cleared. Click to return to standard redaction."
                : "Clear everything on PDF except the selected DO area."
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm whitespace-nowrap border ${
              redactionMode === "isolate_do"
                ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-400 ring-2 ring-purple-400/50 animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>{redactionMode === "isolate_do" ? "Keep DO Only (ACTIVE)" : "Clear Image (Keep DO)"}</span>
          </button>

          {/* Redaction Color Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5 text-xs">
            <button
              onClick={() => setRedactionColor("white")}
              title="Whiteout Redaction (Matches paper, 90%+ smaller file size)"
              className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                redactionColor === "white"
                  ? "bg-slate-100 text-slate-950 font-bold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 inline-block" />
              <span>White</span>
            </button>
            <button
              onClick={() => setRedactionColor("black")}
              title="Classic Blackout Redaction"
              className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                redactionColor === "black"
                  ? "bg-slate-800 text-white font-bold border border-slate-600"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-black border border-slate-500 inline-block" />
              <span>Black</span>
            </button>
          </div>

          {/* Quality Preset Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md px-2 py-1 text-xs">
            <span className="text-slate-400 font-medium hidden lg:inline">Size:</span>
            <select
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[110px] lg:max-w-none truncate"
              title="Select compression preset for sanitized PDF output"
            >
              <option value="compact" className="bg-slate-900 text-slate-100">
                Compact
              </option>
              <option value="balanced" className="bg-slate-900 text-slate-100">
                Balanced
              </option>
              <option value="max" className="bg-slate-900 text-slate-100">
                Print Quality
              </option>
            </select>
          </div>

          <button
            onClick={handleExportSanitizedPdf}
            disabled={!pdfDoc || censorBoxes.length === 0 || isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shadow-sm whitespace-nowrap"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export</span>
          </button>
        </div>

        {/* Mobile Quick Actions in Header */}
        <div className="flex md:hidden items-center gap-1">
          {/* Quick Color Toggle */}
          <button
            onClick={() => setRedactionColor(prev => prev === "white" ? "black" : "white")}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1"
            title="Toggle White/Black"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full border inline-block ${
                redactionColor === "white" ? "bg-white border-slate-300" : "bg-black border-slate-500"
              }`}
            />
            <span>{redactionColor === "white" ? "White" : "Black"}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
            title="Open PDF"
          >
            <FileUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportSanitizedPdf}
            disabled={!pdfDoc || censorBoxes.length === 0 || isExporting}
            className="p-1.5 rounded-md bg-emerald-600 text-white disabled:opacity-30"
            title="Export Sanitized PDF"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR (Desktop drawer + Mobile slide-over) */}
        <aside
          className={`
            fixed md:relative inset-y-16 md:inset-y-0 left-0 z-40 md:z-10
            w-80 max-w-[85vw] bg-slate-900/95 border-r border-slate-800/80
            flex flex-col shrink-0 overflow-hidden shadow-2xl md:shadow-none
            transition-transform duration-300 ease-in-out
            ${isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}
        >
          {/* Dropzone */}
          <div className="p-4 border-b border-slate-800">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-700 hover:border-slate-500 rounded-lg p-3 text-center cursor-pointer transition-colors bg-slate-950/40"
            >
              <FileText className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-200">
                {pdfDoc ? "Click to open another PDF" : "Drop your PDF file here"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Scanned documents, forms & images supported
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Redaction Scope
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {censorBoxes.length} {censorBoxes.length === 1 ? "box" : "boxes"} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-md border border-slate-800">
              <button
                onClick={() => setActiveBoxScope("all")}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeBoxScope === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Apply new boxes to all pages"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Pages</span>
              </button>
              <button
                onClick={() => setActiveBoxScope("current")}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeBoxScope === "current"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Apply new boxes to current page only"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Current Only</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
              {activeBoxScope === "all"
                ? "Boxes drawn will cover this exact coordinate on all pages (ideal for recurring scanned headers/signatures)."
                : `Boxes drawn will only apply to Page ${currentPage}.`}
            </p>
          </div>

          {/* Auto-Censor Layout Templates */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Layout Templates
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExportTemplatesFile}
                  title="Export templates to JSON backup file"
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={() => templateFileInputRef.current?.click()}
                  title="Import templates from JSON file"
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                </button>
                <input
                  ref={templateFileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImportTemplatesFile}
                  className="hidden"
                />
              </div>
            </div>

            <button
              onClick={handleSaveCurrentAsTemplate}
              disabled={censorBoxes.length === 0}
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-950/60"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Current Layout as Template</span>
            </button>

            {savedTemplates.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic text-center py-1">
                No templates saved yet. Draw your redactions once, then save them here!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between p-1.5 px-2 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs"
                  >
                    <button
                      onClick={() => handleApplyTemplate(tpl)}
                      className="flex-1 text-left truncate text-slate-200 hover:text-emerald-400 font-medium flex items-center gap-1.5"
                      title={`Apply ${tpl.name} (${tpl.boxes.length} zones)`}
                    >
                      <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{tpl.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({tpl.boxes.length} {tpl.boxes.length === 1 ? "box" : "boxes"})
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Box List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Redactions
              </span>
              {censorBoxes.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {censorBoxes.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800/80 rounded-lg p-4 text-slate-500 text-xs">
                No redactions yet.
                <p className="mt-1 text-[11px] text-slate-600">
                  Click and drag across the document image to blackout sensitive information.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {censorBoxes.map((box, index) => {
                  const isSelected = selectedBoxId === box.id;
                  return (
                    <div
                      key={box.id}
                      onClick={() => setSelectedBoxId(box.id)}
                      className={`group flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-slate-800/90 border-emerald-500/50 text-white"
                          : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-sm border shrink-0 ${
                              redactionColor === "white"
                                ? "bg-white border-slate-400"
                                : "bg-black border-slate-600"
                            }`}
                          />
                          <span className="font-medium truncate">
                            {box.label || `Area ${index + 1}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>
                            {Math.round(box.x * 100)}%, {Math.round(box.y * 100)}%
                          </span>
                          <span>·</span>
                          <span>
                            {Math.round(box.width * 100)}% × {Math.round(box.height * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetCurrentAsDoZone(box);
                          }}
                          title="Mark this box as the DO Number extraction zone"
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium border transition-colors ${
                            doZoneBox?.id === box.id
                              ? "bg-amber-950/80 border-amber-600 text-amber-300 font-semibold"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300"
                          }`}
                        >
                          {doZoneBox?.id === box.id ? "DO Zone ★" : "Set DO"}
                        </button>
                        <button
                          onClick={(e) => toggleBoxScope(box.id, e)}
                          title={
                            box.pageIndex === "all"
                              ? "Applied to ALL pages. Click to switch to current page."
                              : `Applied to Page ${box.pageIndex}. Click to apply to all.`
                          }
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium border transition-colors ${
                            box.pageIndex === "all"
                              ? "bg-emerald-950/70 border-emerald-800/80 text-emerald-300"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {box.pageIndex === "all" ? "All" : `P.${box.pageIndex}`}
                        </button>
                        <button
                          onClick={(e) => handleDeleteBox(box.id, e)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          title="Delete box"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/50">
            <div className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">100% In-Browser Privacy:</span>{" "}
                Redactions are burned into the image pixels before export to prevent OCR recovery.
              </div>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {isMobileDrawerOpen && (
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
          />
        )}

        {/* CENTRAL VIEWPORT */}
        <main className="flex-1 bg-slate-950 overflow-auto flex flex-col items-center justify-start p-3 sm:p-6 pb-20 md:pb-8 relative">
          {!pdfDoc ? (
            <div className="flex flex-col items-center justify-center my-auto max-w-md text-center py-10 px-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-emerald-400 shadow-inner">
                <ShieldCheck className="w-7 h-7 md:w-8 md:h-8" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">
                Permanent PDF Redaction & Censor
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mb-6 leading-normal">
                Drop your scanned PDF document here or test with our sample file to redact sensitive
                information.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2"
                >
                  <FileUp className="w-4 h-4" />
                  Select PDF Document
                </button>
                <button
                  onClick={handleLoadSample}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-md transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Try Sample Document
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center max-w-full">
              {/* Document Info Pill */}
              <div className="mb-3 flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full shadow-sm">
                <span>Page {currentPage}/{numPages}</span>
                <span>·</span>
                <span>{visibleBoxes.length} box(es)</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline text-emerald-400">Drag to draw censor box</span>
              </div>

              {/* Render Error Alert */}
              {renderError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 max-w-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renderError}</span>
                </div>
              )}

              {/* Page Container with touch-action none for finger dragging */}
              <div
                ref={pageContainerRef}
                className="relative shadow-2xl bg-white rounded-sm overflow-hidden select-none border border-slate-700 max-w-full"
                style={{ cursor: "crosshair", touchAction: "none" }}
              >
                {/* PDF Page Canvas */}
                <canvas ref={canvasRef} className="block max-w-full h-auto" />

                {/* Overlay for drawing & displaying censor boxes */}
                <div
                  ref={overlayRef}
                  className="absolute inset-0"
                  style={{ touchAction: "none" }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* In Isolate DO Mode: render the 4 whiteout masks around DO box */}
                  {redactionMode === "isolate_do" && (() => {
                    const target = doZoneBox || censorBoxes[0];
                    if (!target) return null;
                    const maskBg = redactionColor === "white" ? "bg-white/95" : "bg-black/95";
                    return (
                      <>
                        {/* Top mask */}
                        <div
                          style={{ top: 0, left: 0, right: 0, height: `${target.y * 100}%` }}
                          className={`absolute ${maskBg} pointer-events-none transition-all border-b border-purple-500/40`}
                        />
                        {/* Bottom mask */}
                        <div
                          style={{ top: `${(target.y + target.height) * 100}%`, left: 0, right: 0, bottom: 0 }}
                          className={`absolute ${maskBg} pointer-events-none transition-all border-t border-purple-500/40`}
                        />
                        {/* Left mask */}
                        <div
                          style={{ top: `${target.y * 100}%`, left: 0, width: `${target.x * 100}%`, height: `${target.height * 100}%` }}
                          className={`absolute ${maskBg} pointer-events-none transition-all border-r border-purple-500/40`}
                        />
                        {/* Right mask */}
                        <div
                          style={{ top: `${target.y * 100}%`, left: `${(target.x + target.width) * 100}%`, right: 0, height: `${target.height * 100}%` }}
                          className={`absolute ${maskBg} pointer-events-none transition-all border-l border-purple-500/40`}
                        />
                        {/* Highlight around the preserved DO area */}
                        <div
                          style={{
                            left: `${target.x * 100}%`,
                            top: `${target.y * 100}%`,
                            width: `${target.width * 100}%`,
                            height: `${target.height * 100}%`,
                          }}
                          className="absolute border-2 border-dashed border-purple-500 pointer-events-none bg-purple-500/10 shadow-lg"
                        >
                          <span className="absolute -top-6 left-0 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                            DO Area (Preserved)
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {/* Normal Censor Boxes */}
                  {redactionMode === "normal" &&
                    visibleBoxes.map((box, idx) => {
                      const isSelected = selectedBoxId === box.id;
                      const isWhite = redactionColor === "white";
                      return (
                        <div
                          key={box.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBoxId(box.id);
                          }}
                          style={{
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.width * 100}%`,
                            height: `${box.height * 100}%`,
                          }}
                          className={`absolute cursor-pointer pointer-events-auto transition-all ${
                            isWhite
                              ? isSelected
                                ? "bg-white/95 border-2 border-emerald-500 ring-2 ring-emerald-400/50 shadow-md"
                                : "bg-white/95 border border-slate-300 hover:ring-1 hover:ring-amber-400 shadow-sm"
                              : isSelected
                              ? "bg-black ring-2 ring-emerald-400 border border-emerald-300"
                              : "bg-black border border-neutral-900 hover:ring-1 hover:ring-amber-400"
                          }`}
                          title={box.label || `Area ${idx + 1}`}
                        >
                          <div
                            className={`absolute top-0 left-0 text-[9px] px-1 py-0.5 rounded-br font-mono leading-none flex items-center gap-1 pointer-events-none ${
                              isWhite
                                ? "bg-slate-200 text-slate-800 border-r border-b border-slate-300"
                                : "bg-neutral-900 text-white"
                            }`}
                          >
                            <span className="text-emerald-500">●</span>
                            {box.pageIndex === "all" ? "All" : `P.${box.pageIndex}`}
                          </div>
                        </div>
                      );
                    })}

                  {/* Drag Drawing Preview */}
                  {isDrawing && previewBox && (
                    <div
                      style={{
                        left: `${previewBox.x}px`,
                        top: `${previewBox.y}px`,
                        width: `${previewBox.w}px`,
                        height: `${previewBox.h}px`,
                      }}
                      className={`absolute border border-emerald-400 pointer-events-none ${
                        redactionColor === "white" ? "bg-white/90" : "bg-black/85"
                      }`}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Drag Overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm border-2 border-dashed border-emerald-500 flex flex-col items-center justify-center z-50 pointer-events-none">
              <FileUp className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
              <p className="text-lg font-semibold text-white">Drop your PDF here</p>
              <p className="text-xs text-slate-400">We'll load it immediately in-browser</p>
            </div>
          )}

          {/* Export Modal */}
          {isExporting && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Sanitizing & Exporting PDF
                    </h3>
                    <p className="text-xs text-slate-400">
                      Rasterizing pages and permanently burning redaction pixels
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>{exportStatusText}</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-200"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Underlying text layers and OCR data are permanently destroyed.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DO Number Extraction Modal */}
          {showDoModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <ScanText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        Extracted DO Numbers ({uniqueDoNumbers.length} unique · {doExtractResults.length} / {numPages} pages)
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isExtractingDo
                          ? `Scanning target zone on page ${doExtractResults.length + 1}...`
                          : "Clean DO numbers extracted from document zone."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setDoViewMode("clean")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          doViewMode === "clean"
                            ? "bg-amber-500/20 text-amber-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        DO Only
                      </button>
                      <button
                        onClick={() => setDoViewMode("all")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          doViewMode === "all"
                            ? "bg-amber-500/20 text-amber-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        By Page
                      </button>
                    </div>
                    <button
                      onClick={() => setShowDoModal(false)}
                      disabled={isExtractingDo}
                      className="text-slate-400 hover:text-white p-1 text-sm font-bold disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar while extracting */}
                {isExtractingDo && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-amber-300 font-mono mb-1">
                      <span>Scanning pages...</span>
                      <span>{doExtractProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full transition-all duration-150"
                        style={{ width: `${doExtractProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Results Display */}
                {doViewMode === "clean" ? (
                  <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950 p-4 mb-4 flex flex-col justify-between">
                    <div className="font-mono text-sm leading-relaxed space-y-1 text-slate-100 select-all overflow-y-auto max-h-[300px]">
                      {uniqueDoNumbers.length > 0 ? (
                        uniqueDoNumbers.map((num, idx) => (
                          <div key={idx} className="font-semibold tracking-wide text-emerald-400">
                            {num}
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 italic text-xs">
                          {isExtractingDo ? "Reading DO numbers..." : "No DO numbers found."}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="font-mono text-xs font-bold text-amber-400">
                        total do. : {uniqueDoNumbers.length}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Duplicates removed automatically
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/60 mb-4">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold w-16">Page</th>
                          <th className="py-2.5 px-3 font-semibold">Extracted DO Number</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-500">Raw Zone Text</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {doExtractResults.map((r) => (
                          <tr key={r.page} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-400">P.{r.page}</td>
                            <td className="py-2 px-3 font-semibold text-emerald-400">
                              {r.doNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-xs">
                              {r.rawText || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    {doViewMode === "clean" ? (
                      <span>Clean list ready to copy.</span>
                    ) : (
                      <span>Full per-page audit log.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDoList}
                      disabled={doExtractResults.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                    >
                      {copiedDoList ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{doViewMode === "clean" ? "Copy Clean List" : "Copy All Pages"}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportDoCsv}
                      disabled={doExtractResults.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={() => setShowDoModal(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Mobile Bottom Navigation Bar */}
          <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur z-20 flex items-center justify-between py-2 px-2">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex flex-col items-center gap-1 text-[10px] text-slate-300 hover:text-white"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Redact</span>
            </button>
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex flex-col items-center gap-1 text-[10px] text-slate-300 hover:text-white"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => handleToggleIsolateDoMode()}
              disabled={!pdfDoc || censorBoxes.length === 0}
              className={`flex flex-col items-center gap-1 text-[10px] disabled:opacity-30 ${
                redactionMode === "isolate_do" ? "text-purple-400 font-bold animate-pulse" : "text-purple-300"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{redactionMode === "isolate_do" ? "Keep DO (ON)" : "Keep DO"}</span>
            </button>
            <button
              onClick={handleBatchExtractDo}
              disabled={!pdfDoc || censorBoxes.length === 0 || isExtractingDo}
              className="flex flex-col items-center gap-1 text-[10px] text-amber-400 disabled:opacity-30"
            >
              <ScanText className="w-4 h-4" />
              <span>Extract DO</span>
            </button>
            <button
              onClick={handleExportSanitizedPdf}
              disabled={!pdfDoc || censorBoxes.length === 0 || isExporting}
              className="flex flex-col items-center gap-1 text-[10px] text-emerald-400 font-semibold disabled:opacity-30"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </main>
      </div>

      {/* MODERN FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-16 md:bottom-6 right-4 left-4 md:left-auto md:w-96 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            info: "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-slate-950/50",
            success: "bg-emerald-950/95 border-emerald-500/60 text-emerald-100 shadow-emerald-950/50",
            warning: "bg-amber-950/95 border-amber-500/60 text-amber-100 shadow-amber-950/50",
            error: "bg-rose-950/95 border-rose-500/60 text-rose-100 shadow-rose-950/50",
          };

          const typeIcon = {
            info: <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />,
            success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border backdrop-blur-md shadow-xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${typeStyles[toast.type]}`}
            >
              {typeIcon[toast.type]}
              <span className="text-xs font-medium leading-relaxed flex-1">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* MODERN CONFIRMATION MODAL */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-full ${
                  confirmDialog.isDestructive
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {confirmDialog.isDestructive ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">{confirmDialog.title}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {confirmDialog.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  confirmDialog.isDestructive
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {confirmDialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODERN PROMPT INPUT MODAL */}
      {promptDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (promptInputValue.trim()) {
                setPromptDialog((prev) => ({ ...prev, isOpen: false }));
                promptDialog.onConfirm(promptInputValue.trim());
              }
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="text-sm font-semibold text-white">{promptDialog.title}</h3>
              {promptDialog.message && (
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {promptDialog.message}
                </p>
              )}
            </div>

            <div>
              <input
                type="text"
                autoFocus
                value={promptInputValue}
                onChange={(e) => setPromptInputValue(e.target.value)}
                placeholder={promptDialog.placeholder || "Enter name..."}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setPromptDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!promptInputValue.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
              >
                {promptDialog.confirmLabel || "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
