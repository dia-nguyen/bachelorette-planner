export const MOODBOARD_IMAGES_BUCKET = "moodboard-images";

const PUBLIC_URL_SEGMENT = `/storage/v1/object/public/${MOODBOARD_IMAGES_BUCKET}/`;

export function getMoodboardImageExtension(
  contentType?: string | null,
  fileName?: string | null,
) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/jpg" || contentType === "image/jpeg") return "jpg";

  const rawExtension = fileName?.split(".").pop()?.trim().toLowerCase();
  if (!rawExtension) return "jpg";
  return rawExtension === "jpeg" ? "jpg" : rawExtension;
}

export function buildMoodboardStoragePath(
  tripId: string,
  imageId: string,
  extension: string,
) {
  return `${tripId}/${imageId}.${extension}`;
}

export function getMoodboardStoragePathFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const index = parsed.pathname.indexOf(PUBLIC_URL_SEGMENT);
    if (index === -1) return null;
    return decodeURIComponent(
      parsed.pathname.slice(index + PUBLIC_URL_SEGMENT.length),
    );
  } catch {
    return null;
  }
}
