import type { NoteImage } from "@/lib/data/types";

export const NOTE_IMAGE_MIN_WIDTH = 60;
export const NOTE_IMAGE_GAP = 8;
export const NOTE_IMAGE_STAGE_PADDING = 8;
const DEFAULT_IMAGE_WIDTH = 140;
const MAX_PASTE_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export function getNoteImageStageWidth(noteWidth: number) {
  return Math.max(
    NOTE_IMAGE_MIN_WIDTH,
    Math.floor(noteWidth - NOTE_IMAGE_STAGE_PADDING * 2 - 4),
  );
}

export function getDefaultNoteImageWidth(noteWidth: number) {
  const stageWidth = getNoteImageStageWidth(noteWidth);
  return Math.max(
    NOTE_IMAGE_MIN_WIDTH,
    Math.min(
      DEFAULT_IMAGE_WIDTH,
      Math.floor((stageWidth - NOTE_IMAGE_GAP) / 2),
    ),
  );
}

export function getDefaultNoteImagePosition(
  index: number,
  noteWidth: number,
  imageWidth?: number | null,
) {
  const stageWidth = getNoteImageStageWidth(noteWidth);
  const width = imageWidth ?? getDefaultNoteImageWidth(noteWidth);
  const step = width + NOTE_IMAGE_GAP;
  const itemsPerRow = Math.max(
    1,
    Math.floor((stageWidth + NOTE_IMAGE_GAP) / step),
  );

  return {
    x: (index % itemsPerRow) * step,
    y: Math.floor(index / itemsPerRow) * step,
  };
}

export function normalizeNoteImage(
  image: NoteImage,
  index: number,
  noteWidth: number,
): NoteImage {
  const width = image.width ?? getDefaultNoteImageWidth(noteWidth);
  const fallback = getDefaultNoteImagePosition(index, noteWidth, width);

  return {
    ...image,
    width,
    x: Number.isFinite(image.x) ? image.x : fallback.x,
    y: Number.isFinite(image.y) ? image.y : fallback.y,
  };
}

export function normalizeNoteImages(images: NoteImage[], noteWidth: number) {
  return images.map((image, index) =>
    normalizeNoteImage(image, index, noteWidth),
  );
}

export async function optimizePastedImage(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load pasted image."));
      image.src = objectUrl;
    });

    let { width, height } = img;
    if (width > MAX_PASTE_IMAGE_DIMENSION || height > MAX_PASTE_IMAGE_DIMENSION) {
      const ratio = Math.min(
        MAX_PASTE_IMAGE_DIMENSION / width,
        MAX_PASTE_IMAGE_DIMENSION / height,
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to prepare pasted image.");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const isPng = file.type === "image/png";
    const outputType = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, isPng ? undefined : JPEG_QUALITY);
    });

    if (!blob) {
      throw new Error("Failed to process pasted image.");
    }

    const extension = outputType === "image/png" ? "png" : "jpg";
    return new File([blob], `moodboard.${extension}`, { type: outputType });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
