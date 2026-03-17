"use client";

import type {
  MoodboardNote,
  NoteImage as NoteImageType,
  StickyNoteColor,
} from "@/lib/data/types";
import { isCanvasImageNote } from "@/lib/moodboard/display";
import {
  getNoteImageStageWidth,
  normalizeNoteImage,
  normalizeNoteImages,
  NOTE_IMAGE_GAP,
  NOTE_IMAGE_MIN_WIDTH,
  optimizePastedImage,
} from "@/lib/moodboard/images";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

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
  onUploadImage: (noteId: string, file: File) => Promise<NoteImageType>;
  canvasScale: number;
}

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const NOTE_RESIZE_SENSITIVITY = 0.55;

export function StickyNote({
  note,
  onUpdate,
  onDelete,
  onBringToFront,
  onUploadImage,
  canvasScale,
}: StickyNoteProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftText, setDraftText] = useState(note.text);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const titleSaveTimeoutRef = useRef<number | null>(null);
  const textSaveTimeoutRef = useRef<number | null>(null);
  const latestDraftTitleRef = useRef(note.title);
  const latestDraftTextRef = useRef(note.text);

  const stageWidth = useMemo(() => getNoteImageStageWidth(note.width), [note.width]);
  const isCanvasImage = useMemo(() => isCanvasImageNote(note), [note]);
  const interactiveStageWidth = isCanvasImage ? note.width : stageWidth;
  const normalizedImages = useMemo(
    () => normalizeNoteImages(note.images ?? [], note.width),
    [note.images, note.width],
  );

  useEffect(() => {
    setImageRatios((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id]) =>
          normalizedImages.some((image) => image.id === id),
        ),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [normalizedImages]);

  useEffect(() => {
    if (
      selectedImageId &&
      !normalizedImages.some((image) => image.id === selectedImageId)
    ) {
      setSelectedImageId(null);
    }
  }, [normalizedImages, selectedImageId]);

  useEffect(() => {
    if (isCanvasImage) return;
    setDraftTitle(note.title);
  }, [isCanvasImage, note.id, note.title]);

  useEffect(() => {
    if (isCanvasImage) return;
    setDraftText(note.text);
  }, [isCanvasImage, note.id, note.text]);

  useEffect(() => {
    latestDraftTitleRef.current = draftTitle;
  }, [draftTitle]);

  useEffect(() => {
    latestDraftTextRef.current = draftText;
  }, [draftText]);

  const flushTitleSave = useCallback(
    (value: string) => {
      if (isCanvasImage) return;
      if (titleSaveTimeoutRef.current) {
        window.clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }

      if (value !== note.title) {
        onUpdate(note.id, { title: value });
      }
    },
    [isCanvasImage, note.id, note.title, onUpdate],
  );

  const flushTextSave = useCallback(
    (value: string) => {
      if (isCanvasImage) return;
      if (textSaveTimeoutRef.current) {
        window.clearTimeout(textSaveTimeoutRef.current);
        textSaveTimeoutRef.current = null;
      }

      if (value !== note.text) {
        onUpdate(note.id, { text: value });
      }
    },
    [isCanvasImage, note.id, note.text, onUpdate],
  );

  useEffect(() => {
    if (isCanvasImage) return;
    if (draftTitle === note.title) return;

    titleSaveTimeoutRef.current = window.setTimeout(() => {
      flushTitleSave(draftTitle);
    }, 250);

    return () => {
      if (titleSaveTimeoutRef.current) {
        window.clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }
    };
  }, [draftTitle, flushTitleSave, isCanvasImage, note.title]);

  useEffect(() => {
    if (isCanvasImage) return;
    if (draftText === note.text) return;

    textSaveTimeoutRef.current = window.setTimeout(() => {
      flushTextSave(draftText);
    }, 250);

    return () => {
      if (textSaveTimeoutRef.current) {
        window.clearTimeout(textSaveTimeoutRef.current);
        textSaveTimeoutRef.current = null;
      }
    };
  }, [draftText, flushTextSave, isCanvasImage, note.text]);

  useEffect(() => () => {
    flushTitleSave(latestDraftTitleRef.current);
    flushTextSave(latestDraftTextRef.current);
  }, [flushTextSave, flushTitleSave]);

  useEffect(() => {
    if (!selectedImageId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const noteElement = noteRef.current;
      const target = event.target as HTMLElement | null;
      if (!noteElement || !target) return;

      if (!noteElement.contains(target)) {
        setSelectedImageId(null);
        return;
      }

      if (!target.closest("[data-note-image='true']")) {
        setSelectedImageId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [selectedImageId]);

  const imageStageHeight = useMemo(() => {
    if (normalizedImages.length === 0) return 0;

    const bottom = normalizedImages.reduce((max, image) => {
      const ratio = imageRatios[image.id] ?? 1;
      const width = image.width ?? NOTE_IMAGE_MIN_WIDTH;
      const height = width / ratio;
      return Math.max(max, image.y + height);
    }, 0);

    return Math.max(108, Math.ceil(bottom + NOTE_IMAGE_GAP));
  }, [imageRatios, normalizedImages]);

  const handleDragStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input, textarea, button, [data-note-image='true'], [data-resize='true']")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onBringToFront(note.id);
      setSelectedImageId(null);
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX / canvasScale - note.x,
        y: e.clientY / canvasScale - note.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canvasScale, note.id, note.x, note.y, onBringToFront],
  );

  const handleDragMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      const newX = e.clientX / canvasScale - dragOffset.current.x;
      const newY = e.clientY / canvasScale - dragOffset.current.y;
      onUpdate(note.id, { x: newX, y: newY });
    },
    [canvasScale, isDragging, note.id, onUpdate],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [note.height, note.id, note.width, onBringToFront],
  );

  const handleResizeMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isResizing) return;
      e.preventDefault();
      const dx =
        ((e.clientX - resizeStart.current.x) / canvasScale) *
        NOTE_RESIZE_SENSITIVITY;
      const dy =
        ((e.clientY - resizeStart.current.y) / canvasScale) *
        NOTE_RESIZE_SENSITIVITY;
      const newW = Math.max(MIN_WIDTH, resizeStart.current.w + dx);
      const newH = Math.max(MIN_HEIGHT, resizeStart.current.h + dy);
      onUpdate(note.id, { width: newW, height: newH });
    },
    [canvasScale, isResizing, note.id, onUpdate],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (e.target !== textareaRef.current || document.activeElement !== textareaRef.current) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;

        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        void (async () => {
          setIsUploadingImage(true);
          setUploadError(null);

          try {
            const uploadFile = await optimizePastedImage(file);
            const uploadedImage = await onUploadImage(note.id, uploadFile);
            const positionedImage = normalizeNoteImage(
              uploadedImage,
              normalizedImages.length,
              note.width,
            );
            onUpdate(note.id, {
              images: [...normalizedImages, positionedImage],
            });
          } catch (error) {
            console.error("[StickyNote] Failed to upload pasted image:", error);
            setUploadError("Image upload failed.");
          } finally {
            setIsUploadingImage(false);
          }
        })();
        return;
      }
    },
    [normalizedImages, note.id, note.width, onUpdate, onUploadImage],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [draftText]);

  const handleRemoveImage = useCallback(
    (imgId: string) => {
      if (isCanvasImage && normalizedImages.length === 1) {
        onDelete(note.id);
        return;
      }

      onUpdate(note.id, {
        images: normalizedImages.filter((image) => image.id !== imgId),
      });
    },
    [isCanvasImage, normalizedImages, note.id, onDelete, onUpdate],
  );

  const handleChangeImage = useCallback(
    (imgId: string, patch: Partial<NoteImageType>) => {
      onUpdate(note.id, {
        images: normalizedImages.map((image) =>
          image.id === imgId ? { ...image, ...patch } : image,
        ),
      });
    },
    [normalizedImages, note.id, onUpdate],
  );

  const handleImageRatioChange = useCallback(
    (imgId: string, ratio: number) => {
      setImageRatios((prev) =>
        prev[imgId] === ratio ? prev : { ...prev, [imgId]: ratio },
      );
    },
    [],
  );

  const bg = COLOR_MAP[note.color];
  const border = COLOR_BORDER[note.color];

  return (
    <div
      ref={noteRef}
      data-sticky-note="true"
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      style={{
        position: "absolute",
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        zIndex: note.zIndex,
        background: isCanvasImage ? "transparent" : bg,
        borderLeft: isCanvasImage ? "none" : `4px solid ${border}`,
        borderRadius: "6px",
        boxShadow: isDragging
          ? "0 8px 32px rgba(0,0,0,0.18)"
          : isCanvasImage
            ? "none"
            : "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: isCanvasImage ? "visible" : "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: isDragging ? "none" : "auto",
        transition: isDragging ? "none" : "box-shadow 0.2s",
      }}
    >
      {!isCanvasImage && (
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
            value={draftTitle}
            onBlur={(e) => flushTitleSave(e.target.value)}
            onChange={(e) => setDraftTitle(e.target.value)}
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

          <div style={{ display: "flex", gap: 2 }}>
            {(Object.keys(COLOR_MAP) as StickyNoteColor[]).map((color) => (
              <button
                key={color}
                onClick={() => onUpdate(note.id, { color })}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: COLOR_MAP[color],
                  border:
                    color === note.color
                      ? `2px solid ${COLOR_BORDER[color]}`
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
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: isCanvasImage ? "visible" : "auto",
          overflowX: "hidden",
          paddingBottom: isCanvasImage ? 0 : 8,
        }}
      >
        {!isCanvasImage && (
          <textarea
            ref={textareaRef}
            value={draftText}
            onBlur={(e) => flushTextSave(e.target.value)}
            onChange={(e) => {
              setDraftText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Write something... (paste images here)"
            style={{
              flex: "0 0 auto",
              minHeight: 40,
              background: "transparent",
              border: "none",
              resize: "vertical",
              fontSize: 13,
              color: "#374151",
              outline: "none",
              padding: "4px 8px",
              lineHeight: 1.5,
              fontFamily: "inherit",
              overflow: "hidden",
              width: "100%",
            }}
          />
        )}

        {(isUploadingImage || uploadError) && (
          <div
            style={{
              padding: isCanvasImage ? "0 0 6px" : "0 8px 6px",
              fontSize: 11,
              color: uploadError ? "#B91C1C" : "#6B7280",
            }}
          >
            {uploadError ?? "Uploading image..."}
          </div>
        )}

        {isCanvasImage && normalizedImages[0] && (
          <div
            style={{
              position: "relative",
              width: note.width,
              height: note.height,
            }}
          >
            <img
              src={normalizedImages[0].dataUrl}
              alt="Canvas item"
              draggable={false}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            />

            <button
              onClick={() => onDelete(note.id)}
              title="Delete image"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 22,
                height: 22,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              ×
            </button>
          </div>
        )}

        {!isCanvasImage && normalizedImages.length > 0 && (
          <div style={{ padding: isCanvasImage ? 0 : "0 8px 8px" }}>
            <div
              style={{
                position: "relative",
                width: interactiveStageWidth,
                minHeight: isCanvasImage ? note.height : imageStageHeight,
                borderRadius: 6,
                background: isCanvasImage ? "transparent" : "rgba(255,255,255,0.28)",
                border: isCanvasImage ? "none" : "1px dashed rgba(0,0,0,0.08)",
                overflow: isCanvasImage ? "visible" : "hidden",
              }}
            >
              {normalizedImages.map((image) => (
                <NoteImage
                  key={image.id}
                  image={image}
                  isSelected={selectedImageId === image.id}
                  borderColor={border}
                  canvasScale={canvasScale}
                  stageWidth={interactiveStageWidth}
                  onRemove={handleRemoveImage}
                  onChange={handleChangeImage}
                  onImageRatioChange={handleImageRatioChange}
                  onSelect={setSelectedImageId}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        data-resize="true"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
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
          <path
            d="M9 1L1 9M9 5L5 9M9 9L9 9"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

interface NoteImageProps {
  image: NoteImageType;
  isSelected: boolean;
  borderColor: string;
  canvasScale: number;
  stageWidth: number;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<NoteImageType>) => void;
  onImageRatioChange: (id: string, ratio: number) => void;
  onSelect: (id: string) => void;
}

function NoteImage({
  image,
  isSelected,
  borderColor,
  canvasScale,
  stageWidth,
  onRemove,
  onChange,
  onImageRatioChange,
  onSelect,
}: NoteImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragState = useRef({ startX: 0, startY: 0, x: 0, y: 0, width: 0 });
  const resizeState = useRef({
    startX: 0,
    startWidth: 0,
    startLeft: 0,
    corner: "",
  });

  const imageWidth = image.width ?? NOTE_IMAGE_MIN_WIDTH;

  const handleDragStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-image-control='true']")) return;

      e.preventDefault();
      e.stopPropagation();
      onSelect(image.id);
      setIsDragging(true);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        x: image.x,
        y: image.y,
        width: imageWidth,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [image.id, image.x, image.y, imageWidth, onSelect],
  );

  const handleDragMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      const dx = (e.clientX - dragState.current.startX) / canvasScale;
      const dy = (e.clientY - dragState.current.startY) / canvasScale;
      const maxX = Math.max(0, stageWidth - dragState.current.width);

      onChange(image.id, {
        x: Math.min(maxX, Math.max(0, dragState.current.x + dx)),
        y: Math.max(0, dragState.current.y + dy),
      });
    },
    [canvasScale, image.id, isDragging, onChange, stageWidth],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCornerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const corner = e.currentTarget.dataset.corner ?? "";
      setIsResizing(true);
      resizeState.current = {
        startX: e.clientX,
        startWidth: imageWidth,
        startLeft: image.x,
        corner,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [image.x, imageWidth],
  );

  const handleCornerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isResizing) return;

      e.preventDefault();
      e.stopPropagation();

      const dx = (e.clientX - resizeState.current.startX) / canvasScale;
      const isLeft = resizeState.current.corner.includes("left");

      if (isLeft) {
        const maxLeft = resizeState.current.startLeft + resizeState.current.startWidth - NOTE_IMAGE_MIN_WIDTH;
        const newX = Math.min(maxLeft, Math.max(0, resizeState.current.startLeft + dx));
        const newWidth = resizeState.current.startLeft + resizeState.current.startWidth - newX;
        onChange(image.id, { x: newX, width: newWidth });
        return;
      }

      const maxWidth = Math.max(
        NOTE_IMAGE_MIN_WIDTH,
        stageWidth - resizeState.current.startLeft,
      );
      const newWidth = Math.max(
        NOTE_IMAGE_MIN_WIDTH,
        Math.min(maxWidth, resizeState.current.startWidth + dx),
      );
      onChange(image.id, { width: newWidth });
    },
    [canvasScale, image.id, isResizing, onChange, stageWidth],
  );

  const handleCornerUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    onImageRatioChange(image.id, img.naturalWidth / img.naturalHeight);
  }, [image.id, onImageRatioChange]);

  const HANDLE = 10;

  return (
    <div
      data-note-image="true"
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
      style={{
        position: "absolute",
        left: image.x,
        top: image.y,
        width: imageWidth,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
    >
      <img
        ref={imgRef}
        src={image.dataUrl}
        alt="Pasted"
        draggable={false}
        onLoad={handleLoad}
        style={{
          display: "block",
          width: "100%",
          borderRadius: 4,
          objectFit: "contain",
          userSelect: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          pointerEvents: "none",
          outline: isSelected ? `2px solid ${borderColor}` : "none",
          outlineOffset: -2,
        }}
      />

      <button
        data-image-control="true"
        onClick={() => onRemove(image.id)}
        title="Remove image"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: 22,
          height: 22,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          zIndex: 3,
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      >
        ×
      </button>

      {isSelected &&
        (
          ["top-left", "top-right", "bottom-left", "bottom-right"] as const
        ).map((corner) => {
          const isTop = corner.includes("top");
          const isLeft = corner.includes("left");
          const cursor = isTop === isLeft ? "nwse-resize" : "nesw-resize";

          return (
            <div
              key={corner}
              data-image-control="true"
              data-corner={corner}
              onPointerDown={handleCornerDown}
              onPointerMove={handleCornerMove}
              onPointerUp={handleCornerUp}
              onPointerCancel={handleCornerUp}
              style={{
                position: "absolute",
                width: HANDLE,
                height: HANDLE,
                background: borderColor,
                borderRadius: 2,
                opacity: 0.7,
                cursor,
                zIndex: 3,
                ...(isTop ? { top: -HANDLE / 2 } : { bottom: -HANDLE / 2 }),
                ...(isLeft ? { left: -HANDLE / 2 } : { right: -HANDLE / 2 }),
              }}
            />
          );
        })}
    </div>
  );
}
