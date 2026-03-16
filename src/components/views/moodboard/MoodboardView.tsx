"use client";

import { useApp } from "@/lib/context";
import type { MoodboardNote, StickyNoteColor } from "@/lib/data/types";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { StickyNote } from "./StickyNote";

const CANVAS_SIZE = 5000; // virtual canvas size
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;

const NOTE_COLORS: StickyNoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
];

export function MoodboardView() {
  const {
    moodboardNotes,
    addMoodboardNote,
    updateMoodboardNote,
    deleteMoodboardNote,
    currentUserId,
  } = useApp();

  // Canvas pan / zoom state
  const [offset, setOffset] = useState({ x: -CANVAS_SIZE / 2 + 400, y: -CANVAS_SIZE / 2 + 300 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // ---- Pan ----
  const handlePanStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only start pan on middle-click or direct canvas click (not on a note)
      if (e.target !== e.currentTarget && e.button !== 1) return;
      e.preventDefault();
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset],
  );

  const handlePanMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ---- Zoom (scroll wheel) ----
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));

      // Zoom toward cursor
      const factor = newScale / scale;
      setOffset((prev) => ({
        x: mouseX - factor * (mouseX - prev.x),
        y: mouseY - factor * (mouseY - prev.y),
      }));
      setScale(newScale);
    },
    [scale],
  );

  // ---- Add note ----
  const handleAddNote = useCallback(
    (color: StickyNoteColor = "yellow") => {
      const rect = viewportRef.current?.getBoundingClientRect();
      // Place new note near center of current viewport
      const cx = rect ? rect.width / 2 : 400;
      const cy = rect ? rect.height / 2 : 300;
      const canvasX = (cx - offset.x) / scale;
      const canvasY = (cy - offset.y) / scale;

      // Slight random jitter so notes don't stack perfectly
      const jitterX = (Math.random() - 0.5) * 60;
      const jitterY = (Math.random() - 0.5) * 60;

      const maxZ = moodboardNotes.length > 0
        ? Math.max(...moodboardNotes.map((n) => n.zIndex))
        : 0;

      addMoodboardNote({
        title: "",
        text: "",
        imageDataUrl: null,
        color,
        x: canvasX + jitterX,
        y: canvasY + jitterY,
        width: 260,
        height: 200,
        zIndex: maxZ + 1,
        createdByUserId: currentUserId,
        updatedAt: new Date().toISOString(),
      });
    },
    [offset, scale, moodboardNotes, addMoodboardNote, currentUserId],
  );

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

  // ---- Update note ----
  const handleUpdateNote = useCallback(
    (id: string, patch: Partial<MoodboardNote>) => {
      updateMoodboardNote(id, {
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [updateMoodboardNote],
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
      {/* Toolbar */}
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
        {/* Add note buttons for each color */}
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => handleAddNote(color)}
            title={`Add ${color} note`}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              background:
                color === "yellow"
                  ? "#FEF3C7"
                  : color === "pink"
                    ? "#FCE7F3"
                    : color === "blue"
                      ? "#DBEAFE"
                      : color === "green"
                        ? "#D1FAE5"
                        : color === "purple"
                          ? "#EDE9FE"
                          : "#FFEDD5",
            }}
          >
            +
          </button>
        ))}

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
      </div>

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

      {/* Canvas viewport */}
      <div
        ref={viewportRef}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onWheel={handleWheel}
        style={{
          width: "100%",
          height: "100%",
          cursor: isPanning ? "grabbing" : "default",
          overflow: "hidden",
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
              onDelete={deleteMoodboardNote}
              onBringToFront={handleBringToFront}
              canvasScale={scale}
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
            Click a colored button above to add your first sticky note.
            <br />
            Drag the canvas to pan, scroll to zoom.
          </div>
        </div>
      )}
    </div>
  );
}
