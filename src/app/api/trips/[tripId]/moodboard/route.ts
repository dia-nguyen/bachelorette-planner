import type { MoodboardNote, NoteImage } from "@/lib/data";
import { normalizeNoteImages } from "@/lib/moodboard/images";
import {
  getMoodboardStoragePathFromUrl,
  MOODBOARD_IMAGES_BUCKET,
} from "@/lib/moodboard/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTripMember } from "@/lib/supabase/assert-trip-member";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface MoodboardNoteRow {
  id: string;
  trip_id: string;
  title: string | null;
  text: string | null;
  color: MoodboardNote["color"] | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  z_index: number | null;
  created_by_user_id: string | null;
  updated_at: string | null;
}

interface MoodboardImageRow {
  id: string;
  note_id: string;
  storage_path: string | null;
  url: string;
  width: number | null;
  x: number | null;
  y: number | null;
  sort_order: number | null;
}

function formatMoodboardErrorMessage(message: string) {
  if (
    message.includes("moodboard_notes") ||
    message.includes("moodboard_note_images")
  ) {
    return "Moodboard tables are missing in Supabase. Run docs/schema.sql or docs/moodboard-tables.sql, then refresh.";
  }
  if (
    message.includes('column "x"') ||
    message.includes('column "y"') ||
    message.includes(".x") ||
    message.includes(".y")
  ) {
    return "Moodboard image position columns are missing in Supabase. Run the latest docs/schema.sql or the ALTER TABLE statements in docs/moodboard-tables.sql, then refresh.";
  }
  return message;
}

function jsonMoodboardError(message: string, status = 500) {
  return NextResponse.json(
    { error: formatMoodboardErrorMessage(message) },
    { status },
  );
}

function toNote(
  row: MoodboardNoteRow,
  images: MoodboardImageRow[] = [],
): MoodboardNote {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title ?? "",
    text: row.text ?? "",
    color: row.color ?? "yellow",
    x: row.x ?? 0,
    y: row.y ?? 0,
    width: row.width ?? 260,
    height: row.height ?? 200,
    zIndex: row.z_index ?? 0,
    createdByUserId: row.created_by_user_id ?? "",
    updatedAt: row.updated_at ?? new Date().toISOString(),
    images: normalizeNoteImages(
      images
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((image) => ({
        id: image.id,
        dataUrl: image.url,
        width: image.width ?? null,
          x: image.x ?? 0,
          y: image.y ?? 0,
        })),
      row.width ?? 260,
    ),
  };
}

const FIELD_MAP: Record<string, string> = {
  title: "title",
  text: "text",
  color: "color",
  x: "x",
  y: "y",
  width: "width",
  height: "height",
  zIndex: "z_index",
  createdByUserId: "created_by_user_id",
  updatedAt: "updated_at",
};

function toDbPatch(patch: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const dbKey = FIELD_MAP[key];
    if (dbKey) result[dbKey] = value;
  }
  return result;
}

function toImageRows(noteId: string, images: NoteImage[]) {
  return images.map((image, index) => ({
    id: image.id,
    note_id: noteId,
    storage_path: getMoodboardStoragePathFromUrl(image.dataUrl) ?? "",
    url: image.dataUrl,
    width: image.width,
    x: image.x,
    y: image.y,
    sort_order: index,
  }));
}

async function removeStorageObjects(paths: Array<string | null | undefined>) {
  const removablePaths = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path))),
  );

  if (removablePaths.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(MOODBOARD_IMAGES_BUCKET)
    .remove(removablePaths);

  if (error) {
    console.error("[moodboard] Failed to delete storage objects:", error.message);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonMoodboardError("Unauthorized.", 401);
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const { data: notes, error: notesError } = await supabase
    .from("moodboard_notes")
    .select("*")
    .eq("trip_id", tripId)
    .order("z_index", { ascending: true });

  if (notesError) {
    if (notesError.code === "PGRST205") {
      return NextResponse.json([]);
    }
    return jsonMoodboardError(notesError.message);
  }

  if (!notes || notes.length === 0) {
    return NextResponse.json([]);
  }

  const noteIds = notes.map((note) => note.id);
  const { data: images, error: imagesError } = await supabase
    .from("moodboard_note_images")
    .select("*")
    .in("note_id", noteIds)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    if (imagesError.code === "PGRST205") {
      return NextResponse.json(
        (notes as MoodboardNoteRow[]).map((note) => toNote(note, [])),
      );
    }
    return jsonMoodboardError(imagesError.message);
  }

  const imagesByNote = new Map<string, MoodboardImageRow[]>();
  for (const image of (images ?? []) as MoodboardImageRow[]) {
    const noteImages = imagesByNote.get(image.note_id) ?? [];
    noteImages.push(image);
    imagesByNote.set(image.note_id, noteImages);
  }

  return NextResponse.json(
    (notes as MoodboardNoteRow[]).map((note) =>
      toNote(note, imagesByNote.get(note.id) ?? []),
    ),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonMoodboardError("Unauthorized.", 401);
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const body = (await request.json()) as Partial<MoodboardNote>;
  const dbRow: Record<string, unknown> = {
    ...toDbPatch(body as Record<string, unknown>),
    trip_id: tripId,
    created_by_user_id: user.id,
  };

  const { data, error } = await supabase
    .from("moodboard_notes")
    .insert(dbRow)
    .select("*")
    .single();

  if (error) {
    return jsonMoodboardError(error.message);
  }

  return NextResponse.json(toNote(data as MoodboardNoteRow), { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonMoodboardError("Unauthorized.", 401);
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const { id, patch } = (await request.json()) as {
    id: string;
    patch: Partial<MoodboardNote>;
  };

  if (!id || !patch) {
    return jsonMoodboardError("id and patch are required.", 400);
  }

  const dbPatch = toDbPatch(patch as Record<string, unknown>);
  if (Object.keys(dbPatch).length > 0) {
    const { error } = await supabase
      .from("moodboard_notes")
      .update(dbPatch)
      .eq("id", id)
      .eq("trip_id", tripId);

    if (error) {
      return jsonMoodboardError(error.message);
    }
  }

  if (Array.isArray(patch.images)) {
    const incomingImages = patch.images;
    const { data: existingImages, error: existingImagesError } = await supabase
      .from("moodboard_note_images")
      .select("id,note_id,storage_path,url,width,x,y,sort_order")
      .eq("note_id", id);

    if (existingImagesError) {
      return jsonMoodboardError(existingImagesError.message);
    }

    const existingRows = (existingImages ?? []) as MoodboardImageRow[];
    const existingById = new Map(
      existingRows.map((image) => [image.id, image] as const),
    );
    const incomingIds = new Set(incomingImages.map((image) => image.id));
    const removedImages = existingRows.filter((image) => !incomingIds.has(image.id));

    if (removedImages.length > 0) {
      const { error: deleteImagesError } = await supabase
        .from("moodboard_note_images")
        .delete()
        .in(
          "id",
          removedImages.map((image) => image.id),
        );

      if (deleteImagesError) {
        return jsonMoodboardError(deleteImagesError.message);
      }

      await removeStorageObjects(
        removedImages.map((image) => image.storage_path),
      );
    }

    if (incomingImages.length > 0) {
      const upsertRows = incomingImages.map((image, index) => ({
        id: image.id,
        note_id: id,
        storage_path:
          getMoodboardStoragePathFromUrl(image.dataUrl) ??
          existingById.get(image.id)?.storage_path ??
          "",
        url: image.dataUrl,
        width: image.width,
        x: image.x,
        y: image.y,
        sort_order: index,
      }));

      const { error: upsertError } = await supabase
        .from("moodboard_note_images")
        .upsert(upsertRows, { onConflict: "id" });

      if (upsertError) {
        return jsonMoodboardError(upsertError.message);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonMoodboardError("Unauthorized.", 401);
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const { id } = (await request.json()) as { id: string };
  if (!id) {
    return jsonMoodboardError("id is required.", 400);
  }

  const { data: existingImages, error: existingImagesError } = await supabase
    .from("moodboard_note_images")
    .select("storage_path")
    .eq("note_id", id);

  if (existingImagesError) {
    return jsonMoodboardError(existingImagesError.message);
  }

  const { error } = await supabase
    .from("moodboard_notes")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);

  if (error) {
    return jsonMoodboardError(error.message);
  }

  await removeStorageObjects(
    (existingImages ?? []).map((image) => image.storage_path as string | null),
  );

  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const notes = (await request.json()) as MoodboardNote[];

  const { data: existingNotes, error: existingNotesError } = await supabase
    .from("moodboard_notes")
    .select("id")
    .eq("trip_id", tripId);

  if (existingNotesError) {
    return NextResponse.json(
      { error: existingNotesError.message },
      { status: 500 },
    );
  }

  const existingNoteIds = (existingNotes ?? []).map((note) => note.id as string);
  let removedStoragePaths: string[] = [];

  if (existingNoteIds.length > 0) {
    const { data: existingImages, error: existingImagesError } = await supabase
      .from("moodboard_note_images")
      .select("storage_path")
      .in("note_id", existingNoteIds);

    if (existingImagesError) {
      return NextResponse.json(
        { error: existingImagesError.message },
        { status: 500 },
      );
    }

    const retainedPaths = new Set(
      notes
        .flatMap((note) => note.images ?? [])
        .map((image) => getMoodboardStoragePathFromUrl(image.dataUrl))
        .filter((path): path is string => Boolean(path)),
    );

    removedStoragePaths = (existingImages ?? [])
      .map((image) => image.storage_path as string | null)
      .filter((path): path is string => path !== null)
      .filter((path) => !retainedPaths.has(path));
  }

  const { error: deleteNotesError } = await supabase
    .from("moodboard_notes")
    .delete()
    .eq("trip_id", tripId);

  if (deleteNotesError) {
    return NextResponse.json(
      { error: deleteNotesError.message },
      { status: 500 },
    );
  }

  if (notes.length === 0) {
    await removeStorageObjects(removedStoragePaths);
    return NextResponse.json([]);
  }

  const noteRows = notes.map((note) => ({
    id: note.id,
    trip_id: tripId,
    title: note.title ?? "",
    text: note.text ?? "",
    color: note.color ?? "yellow",
    x: note.x ?? 0,
    y: note.y ?? 0,
    width: note.width ?? 260,
    height: note.height ?? 200,
    z_index: note.zIndex ?? 0,
    created_by_user_id: note.createdByUserId || user.id,
    updated_at: note.updatedAt ?? new Date().toISOString(),
  }));

  const { error: insertNotesError } = await supabase
    .from("moodboard_notes")
    .insert(noteRows);

  if (insertNotesError) {
    return NextResponse.json(
      { error: insertNotesError.message },
      { status: 500 },
    );
  }

  const imageRows = notes.flatMap((note) => toImageRows(note.id, note.images ?? []));
  if (imageRows.length > 0) {
    const { error: insertImagesError } = await supabase
      .from("moodboard_note_images")
      .insert(imageRows);

    if (insertImagesError) {
      return NextResponse.json(
        { error: insertImagesError.message },
        { status: 500 },
      );
    }
  }

  await removeStorageObjects(removedStoragePaths);
  return NextResponse.json({ ok: true });
}
