"use client";

import { useApp } from "@/lib/context";
import type { MoodboardNote } from "@/lib/data/types";
import { CANVAS_IMAGE_TITLE } from "@/lib/moodboard/display";
import { normalizeNoteImage, optimizePastedImage } from "@/lib/moodboard/images";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { StickyNote } from "./StickyNote";

const CANVAS_SIZE = 5000; // virtual canvas size
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const DEFAULT_PASTED_NOTE_WIDTH = 320;
const DEFAULT_PASTED_NOTE_HEIGHT = 280;
const MOBILE_BREAKPOINT_QUERY = "(max-width: 768px)";

export function MoodboardView() {
  const {
    moodboardNotes,
    addMoodboardNote,
    updateMoodboardNote,
    deleteMoodboardNote,
    setMoodboardNotes,
    uploadMoodboardImage,
    currentUserId,
  } = useApp();

  // Canvas pan / zoom state
  const [offset, setOffset] = useState({ x: -CANVAS_SIZE / 2 + 400, y: -CANVAS_SIZE / 2 + 300 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isMobileReadOnly, setIsMobileReadOnly] = useState(false);
  const [isPastingImage, setIsPastingImage] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: -CANVAS_SIZE / 2 + 400, y: -CANVAS_SIZE / 2 + 300 });
  const wheelDeltaRef = useRef(0);
  const wheelAnchorRef = useRef({ x: 0, y: 0 });
  const wheelRafRef = useRef<number | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{
    distance: number;
    scale: number;
    anchorCanvasX: number;
    anchorCanvasY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // ---- Undo / Redo history ----
  const undoStack = useRef<MoodboardNote[][]>([]);
  const redoStack = useRef<MoodboardNote[][]>([]);
  const lastSnapshot = useRef<string>("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Take a snapshot before a mutation
  const pushUndo = useCallback(() => {
    const snap = JSON.stringify(moodboardNotes);
    if (snap !== lastSnapshot.current) {
      undoStack.current.push(JSON.parse(lastSnapshot.current || snap));
      redoStack.current = [];
      if (undoStack.current.length > 50) undoStack.current.shift();
      setCanUndo(true);
      setCanRedo(false);
    }
    lastSnapshot.current = snap;
  }, [moodboardNotes]);

  // Keep lastSnapshot fresh on every render
  useEffect(() => {
    lastSnapshot.current = JSON.stringify(moodboardNotes);
  }, [moodboardNotes]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(JSON.parse(JSON.stringify(moodboardNotes)));
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    setMoodboardNotes(prev);
  }, [moodboardNotes, setMoodboardNotes]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(JSON.parse(JSON.stringify(moodboardNotes)));
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    setMoodboardNotes(next);
  }, [moodboardNotes, setMoodboardNotes]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z (or Cmd on Mac)
  useEffect(() => {
    const media = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const sync = () => setIsMobileReadOnly(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobileReadOnly) return;

    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevHtmlOverflow = htmlStyle.overflow;
    const prevBodyOverscroll = bodyStyle.overscrollBehavior;
    const prevHtmlOverscroll = htmlStyle.overscrollBehavior;

    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";
    bodyStyle.overscrollBehavior = "none";
    htmlStyle.overscrollBehavior = "none";

    return () => {
      bodyStyle.overflow = prevBodyOverflow;
      htmlStyle.overflow = prevHtmlOverflow;
      bodyStyle.overscrollBehavior = prevBodyOverscroll;
      htmlStyle.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isMobileReadOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobileReadOnly) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileReadOnly, undo, redo]);

  // ---- Pan ----
  const handlePanStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const clickedNote = target.closest("[data-sticky-note='true']");
      if (clickedNote && !isMobileReadOnly) return;

      const isTouchPointer = e.pointerType === "touch";
      if (!isTouchPointer && e.button !== 0 && e.button !== 1) return;

      e.preventDefault();
      viewportRef.current?.focus();

      const host = e.currentTarget as HTMLElement;
      host.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (isTouchPointer && activePointers.current.size >= 2) {
        const [a, b] = Array.from(activePointers.current.values());
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0) return;

        const midX = (a.x + b.x) / 2 - rect.left;
        const midY = (a.y + b.y) / 2 - rect.top;

        pinchStart.current = {
          distance,
          scale,
          anchorCanvasX: (midX - offset.x) / scale,
          anchorCanvasY: (midY - offset.y) / scale,
        };
        setIsPanning(false);
        return;
      }

      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };
    },
    [isMobileReadOnly, offset.x, offset.y, scale],
  );

  const handlePanMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const isTouchPointer = e.pointerType === "touch";
      if (isTouchPointer && activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (isTouchPointer && pinchStart.current && activePointers.current.size >= 2) {
        const [a, b] = Array.from(activePointers.current.values());
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0) return;

        const pinch = pinchStart.current;
        const midX = (a.x + b.x) / 2 - rect.left;
        const midY = (a.y + b.y) / 2 - rect.top;
        const scaled = pinch.scale * (distance / pinch.distance);
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaled));

        e.preventDefault();
        setScale(nextScale);
        setOffset({
          x: midX - pinch.anchorCanvasX * nextScale,
          y: midY - pinch.anchorCanvasY * nextScale,
        });
        return;
      }

      if (!isPanning) return;
      e.preventDefault();
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setOffset({
        x: panStart.current.ox + dx,
        y: panStart.current.oy + dy,
      });
    },
    [isPanning],
  );

  const handlePanEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    pinchStart.current = activePointers.current.size >= 2 ? pinchStart.current : null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const flushWheelZoom = () => {
      wheelRafRef.current = null;
      const rect = viewport.getBoundingClientRect();
      const deltaY = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      if (deltaY === 0) return;

      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;
      const zoomFactor = Math.exp(-deltaY * 0.0015);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * zoomFactor));
      if (newScale === currentScale) return;

      const factor = newScale / currentScale;
      const mouseX = wheelAnchorRef.current.x - rect.left;
      const mouseY = wheelAnchorRef.current.y - rect.top;
      const nextOffset = {
        x: mouseX - factor * (mouseX - currentOffset.x),
        y: mouseY - factor * (mouseY - currentOffset.y),
      };

      scaleRef.current = newScale;
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
      setScale(newScale);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const deltaY =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? e.deltaY * 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? e.deltaY * viewport.clientHeight
            : e.deltaY;
      wheelDeltaRef.current += deltaY;
      wheelAnchorRef.current = { x: e.clientX, y: e.clientY };
      if (wheelRafRef.current == null) {
        wheelRafRef.current = window.requestAnimationFrame(flushWheelZoom);
      }
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      if (wheelRafRef.current != null) {
        window.cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      wheelDeltaRef.current = 0;
    };
  }, []);

  const getViewportCenterCanvasPoint = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 400;
    const cy = rect ? rect.height / 2 : 300;

    return {
      x: (cx - offset.x) / scale,
      y: (cy - offset.y) / scale,
    };
  }, [offset.x, offset.y, scale]);

  const getNextZIndex = useCallback(
    () =>
      moodboardNotes.length > 0
        ? Math.max(...moodboardNotes.map((note) => note.zIndex)) + 1
        : 1,
    [moodboardNotes],
  );

  const handleCanvasPasteImage = useCallback(
    async (file: File) => {
      const center = getViewportCenterCanvasPoint();
      const noteX = center.x - DEFAULT_PASTED_NOTE_WIDTH / 2;
      const noteY = center.y - DEFAULT_PASTED_NOTE_HEIGHT / 2;

      pushUndo();
      setIsPastingImage(true);
      setPasteError(null);

      const noteId = addMoodboardNote({
        title: CANVAS_IMAGE_TITLE,
        text: "",
        images: [],
        color: "yellow",
        x: noteX,
        y: noteY,
        width: DEFAULT_PASTED_NOTE_WIDTH,
        height: DEFAULT_PASTED_NOTE_HEIGHT,
        zIndex: getNextZIndex(),
        createdByUserId: currentUserId,
        updatedAt: new Date().toISOString(),
      });

      try {
        const uploadFile = await optimizePastedImage(file);
        const uploadedImage = await uploadMoodboardImage(noteId, uploadFile);
        const positionedImage = normalizeNoteImage(
          uploadedImage,
          0,
          DEFAULT_PASTED_NOTE_WIDTH,
        );

        updateMoodboardNote(noteId, {
          images: [positionedImage],
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[MoodboardView] Failed to paste image on canvas:", error);
        deleteMoodboardNote(noteId);
        setPasteError("Image paste failed.");
      } finally {
        setIsPastingImage(false);
      }
    },
    [
      addMoodboardNote,
      currentUserId,
      deleteMoodboardNote,
      getNextZIndex,
      getViewportCenterCanvasPoint,
      pushUndo,
      updateMoodboardNote,
      uploadMoodboardImage,
    ],
  );

  useEffect(() => {
    if (isMobileReadOnly) return;
    const handlePaste = (event: ClipboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement?.closest("[data-sticky-note='true']") &&
        activeElement.matches("input, textarea, [contenteditable='true']")
      ) {
        return;
      }

      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();

      if (!file) return;

      event.preventDefault();
      void handleCanvasPasteImage(file);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleCanvasPasteImage, isMobileReadOnly]);

  // ---- Bring to front ----
  const handleBringToFront = useCallback(
    (id: string) => {
      const maxZ = moodboardNotes.length > 0
        ? Math.max(...moodboardNotes.map((n) => n.zIndex))
        : 0;
      const note = moodboardNotes.find((n) => n.id === id);
      if (note && note.zIndex < maxZ) {
        updateMoodboardNote(id, { zIndex: maxZ + 1 });
      }
    },
    [moodboardNotes, updateMoodboardNote],
  );

  // ---- Update note (with undo snapshot) ----
  const handleUpdateNote = useCallback(
    (id: string, patch: Partial<MoodboardNote>) => {
      pushUndo();
      updateMoodboardNote(id, {
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [updateMoodboardNote, pushUndo],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      const ok = window.confirm("Delete this note?");
      if (!ok) return;
      pushUndo();
      deleteMoodboardNote(id);
    },
    [deleteMoodboardNote, pushUndo],
  );

  // ---- Zoom controls ----
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + 0.2));
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s - 0.2));
  }, []);
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: -CANVAS_SIZE / 2 + 400, y: -CANVAS_SIZE / 2 + 300 });
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#F9FAFB",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {!isMobileReadOnly && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "white",
            borderRadius: 8,
            padding: "6px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {/* Undo / Redo */}
          <button
            onClick={undo}
            title="Undo (Ctrl+Z)"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "white",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: canUndo ? 1 : 0.35,
            }}
          >
            ↩
          </button>
          <button
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "white",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: canRedo ? 1 : 0.35,
            }}
          >
            ↪
          </button>

          <div
            style={{
              width: 1,
              height: 20,
              background: "#E5E7EB",
              margin: "0 4px",
            }}
          />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            title="Zoom out"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "white",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: 12,
              color: "#6B7280",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            title="Zoom in"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "white",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
          <button
            onClick={resetView}
            title="Reset view"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "white",
              cursor: "pointer",
              fontSize: 11,
              color: "#6B7280",
            }}
          >
            Reset
          </button>

          {pasteError && (
            <span
              style={{
                fontSize: 11,
                color: "#B91C1C",
                whiteSpace: "nowrap",
              }}
            >
              {isPastingImage ? "Pasting image..." : pasteError}
            </span>
          )}
        </div>
      )}

      {/* Note count indicator */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
          background: "white",
          borderRadius: 8,
          padding: "6px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          fontSize: 12,
          color: "#6B7280",
        }}
      >
        {moodboardNotes.length} note{moodboardNotes.length !== 1 ? "s" : ""}
      </div>

      {isMobileReadOnly && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 12,
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(17,24,39,0.78)",
            color: "#F9FAFB",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
          }}
        >
          Mobile view only
        </div>
      )}

      {/* Canvas viewport */}
      <div
        ref={viewportRef}
        tabIndex={0}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
        style={{
          width: "100%",
          height: "100%",
          cursor: isPanning ? "grabbing" : "grab",
          overflow: "hidden",
          outline: "none",
          touchAction: isMobileReadOnly ? "none" : "auto",
          overscrollBehavior: isMobileReadOnly ? "none" : "auto",
        }}
      >
        {/* Transformed canvas layer */}
        <div
          style={{
            position: "relative",
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transformOrigin: "0 0",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            // Dot grid background
            backgroundImage:
              "radial-gradient(circle, #D1D5DB 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        >
          {moodboardNotes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onBringToFront={handleBringToFront}
              onUploadImage={uploadMoodboardImage}
              canvasScale={scale}
              isReadOnly={isMobileReadOnly}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      {moodboardNotes.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            color: "#9CA3AF",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎨</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Moodboard
          </div>
          <div style={{ fontSize: 13 }}>
            {isMobileReadOnly
              ? "Drag the canvas to explore."
              : (
                <>
                  Drag the canvas to pan and scroll to zoom.
                </>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
