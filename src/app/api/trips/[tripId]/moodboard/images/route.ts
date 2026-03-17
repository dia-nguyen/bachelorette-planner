import { createAdminClient } from "@/lib/supabase/admin";
import { assertTripMember } from "@/lib/supabase/assert-trip-member";
import { createClient } from "@/lib/supabase/server";
import {
  buildMoodboardStoragePath,
  getMoodboardImageExtension,
  MOODBOARD_IMAGES_BUCKET,
} from "@/lib/moodboard/storage";
import { NextResponse } from "next/server";

function formatUploadErrorMessage(message: string) {
  if (message.toLowerCase().includes("bucket")) {
    return "The moodboard-images storage bucket is missing in Supabase. Run docs/schema.sql or docs/moodboard-tables.sql, then refresh.";
  }
  return message;
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
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const memberCheck = await assertTripMember(supabase, tripId, user.id);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const formData = await request.formData();
  const imageId = formData.get("imageId");
  const file = formData.get("file");

  if (typeof imageId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "imageId and file are required." },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported." },
      { status: 400 },
    );
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5MB." },
      { status: 413 },
    );
  }

  const admin = createAdminClient();
  const extension = getMoodboardImageExtension(file.type, file.name);
  const storagePath = buildMoodboardStoragePath(tripId, imageId, extension);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(MOODBOARD_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: formatUploadErrorMessage(uploadError.message) },
      { status: 500 },
    );
  }

  const { data } = admin.storage
    .from(MOODBOARD_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({
    id: imageId,
    storagePath,
    url: data.publicUrl,
  });
}
