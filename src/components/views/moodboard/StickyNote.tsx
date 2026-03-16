"use client";

import type { MoodboardNote, StickyNoteColor } from "@/lib/data/types";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Sticky note background colors
const COLOR_MAP: Record<StickyNoteColor, string> = {
  yellow: "#FEF3C7",
  pink: "#FCE7F3",
  blue: "#DBEAFE",
  green: "#D1FAE5",
  purple: "#EDE9FE",
  orange: "#FFEDD5",
};

const COLOR_BORDER: Record<StickyNoteColor, string> = {
  yellow: "#F59E0B",
  pink: "#EC4899",
  blue: "#3B82F6",
  green: "#10B981",
  purple: "#8B5CF6",
  orange: "#F97316",
};

interface StickyNoteProps {
  note: MoodboardNote;
  onUpdate: (id: string, patch: Partial<MoodboardNote>) => void;
  onDelete: (id: string) => void;
  onBringToFront: (id: string) => void;
  canvasScale: number;
}

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

export function StickyNote({
  note,
  onUpdate,
  onDelete,
  onBringToFront,
  canvasScale,
}: StickyNoteProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // ---- Drag ----
  const handleDragStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Don't drag if clicking on inputs, textarea, buttons, or resize handle
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.dataset.resize === "true"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onBringToFront(note.id);
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX / canvasScale - note.x,
        y: e.clientY / canvasScale - note.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [note.id, note.x, note.y, canvasScale, onBringToFront],
  );

  const handleDragMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      const newX = e.clientX / canvasScale - dragOffset.current.x;
      const newY = e.clientY / canvasScale - dragOffset.current.y;
      onUpdate(note.id, { x: newX, y: newY });
    },
    [isDragging, canvasScale, note.id, onUpdate],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ---- Resize ----
  const handleResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onBringToFront(note.id);
      setIsResizing(true);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: note.width,
        h: note.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [note.id, note.width, note.height, onBringToFront],
  );

  const handleResizeMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isResizing) return;
      e.preventDefault();
      const dx = (e.clientX - resizeStart.current.x) / canvasScale;
      const dy = (e.clientY - resizeStart.current.y) / canvasScale;
      const newW = Math.max(MIN_WIDTH, resizeStart.current.w + dx);
      const newH = Math.max(MIN_HEIGHT, resizeStart.current.h + dy);
      onUpdate(note.id, { width: newW, height: newH });
    },
    [isResizing, canvasScale, note.id, onUpdate],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // ---- Image paste (with client-side compression) ----
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          const MAX_DIM = 1600;
          const JPEG_QUALITY = 0.8;

          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            // Scale down if either dimension exceeds MAX_DIM
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
              const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);

            // Use JPEG for photos (smaller), PNG for transparency
            const isPng = file.type === "image/png";
            const dataUrl = isPng
              ? canvas.toDataURL("image/png")
              : canvas.toDataURL("image/jpeg", JPEG_QUALITY);

            onUpdate(note.id, { imageDataUrl: dataUrl });
          };
          img.src = objectUrl;
          return;
        }
      }
    },
    [note.id, onUpdate],
  );

  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const bg = COLOR_MAP[note.color];
  const border = COLOR_BORDER[note.color];

  return (
    <div
      ref={noteRef}
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      style={{
        position: "absolute",
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        zIndex: note.zIndex,
        background: bg,
        borderLeft: `4px solid ${border}`,
        borderRadius: "6px",
        boxShadow: isDragging
          ? "0 8px 32px rgba(0,0,0,0.18)"
          : "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: isDragging ? "none" : "auto",
        transition: isDragging ? "none" : "box-shadow 0.2s",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px 2px 8px",
          gap: 4,
        }}
      >
        <input
          value={note.title}
          onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          placeholder="Title"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            color: "#1F2937",
            outline: "none",
            padding: "2px 0",
          }}
        />
        {/* Color picker */}
        <div style={{ display: "flex", gap: 2 }}>
          {(Object.keys(COLOR_MAP) as StickyNoteColor[]).map((c) => (
            <button
              key={c}
              onClick={() => onUpdate(note.id, { color: c })}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLOR_MAP[c],
                border:
                  c === note.color
                    ? `2px solid ${COLOR_BORDER[c]}`
                    : "1px solid #D1D5DB",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
        <button
          onClick={() => onDelete(note.id)}
          title="Delete note"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            color: "#9CA3AF",
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      {/* Text body */}
      <textarea
        value={note.text}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        placeholder="Write something... (paste images here)"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          resize: "none",
          fontSize: 13,
          color: "#374151",
          outline: "none",
          padding: "4px 8px",
          lineHeight: 1.5,
          fontFamily: "inherit",
        }}
      />

      {/* Pasted image */}
      {note.imageDataUrl && (
        <div style={{ padding: "4px 8px 4px", position: "relative" }}>
          <img
            src={note.imageDataUrl}
            alt="Pasted"
            style={{
              maxWidth: "100%",
              maxHeight: 200,
              borderRadius: 4,
              objectFit: "contain",
            }}
          />
          <button
            onClick={() => onUpdate(note.id, { imageDataUrl: null })}
            title="Remove image"
            style={{
              position: "absolute",
              top: 6,
              right: 10,
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 20,
              height: 20,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Resize handle */}
      <div
        data-resize="true"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill={border} opacity={0.5}>
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );
}
