import type { NoteImage } from "@/lib/data/types";

export const NOTE_IMAGE_MIN_WIDTH = 60;
export const NOTE_IMAGE_GAP = 8;
export const NOTE_IMAGE_STAGE_PADDING = 8;
const DEFAULT_IMAGE_WIDTH = 140;

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
