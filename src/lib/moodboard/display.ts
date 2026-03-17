import type { MoodboardNote } from "@/lib/data/types";

export const CANVAS_IMAGE_TITLE = "[canvas-image]";

export function isCanvasImageNote(note: MoodboardNote) {
  return note.title === CANVAS_IMAGE_TITLE && !note.text.trim();
}
