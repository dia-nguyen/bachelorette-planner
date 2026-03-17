import { demoRepository } from "@/lib/data";
import type { Poll } from "@/lib/data";
import { assertTripMember } from "@/lib/supabase/assert-trip-member";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const isSupabase = () => process.env.NEXT_PUBLIC_DATA_MODE === "supabase";

const FIELD_MAP: Record<string, string> = {
  id: "id",
  question: "question",
  createdByUserId: "created_by_user_id",
  options: "options",
  isClosed: "is_closed",
  visibility: "visibility",
  requiredUserIds: "required_user_ids",
  createdAt: "created_at",
};

function toDbPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const dbKey = FIELD_MAP[key];
    if (!dbKey) continue;
    result[dbKey] = value;
  }
  return result;
}

function stripUnsupportedPollColumns(
  payload: Record<string, unknown>,
  message: string | null | undefined,
) {
  if (!message) return payload;

  const unsupported = ["visibility", "required_user_ids"];
  const lowered = message.toLowerCase();
  const cleaned = { ...payload };
  let removedAny = false;

  unsupported.forEach((column) => {
    if (lowered.includes(column.toLowerCase())) {
      delete cleaned[column];
      removedAny = true;
    }
  });

  return removedAny ? cleaned : payload;
}

async function insertPollWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: Record<string, unknown>,
) {
  let payload = { ...row };
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.from("polls").insert(payload).select().single();
    if (!error) return { data, error: null };
    const nextPayload = stripUnsupportedPollColumns(payload, error.message);
    if (nextPayload === payload) return { data: null, error };
    payload = nextPayload;
  }
  return { data: null, error: { message: "Failed to create poll." } as { message: string } };
}

async function updatePollWithFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  tripId: string,
  patch: Record<string, unknown>,
) {
  let payload = { ...patch };
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from("polls")
      .update(payload)
      .eq("id", id)
      .eq("trip_id", tripId)
      .select()
      .single();
    if (!error) return { data, error: null };
    const nextPayload = stripUnsupportedPollColumns(payload, error.message);
    if (nextPayload === payload) return { data: null, error };
    payload = nextPayload;
  }
  return { data: null, error: { message: "Failed to update poll." } as { message: string } };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const memberCheck = await assertTripMember(supabase, tripId, user.id);
    if (memberCheck instanceof NextResponse) return memberCheck;
    const { data, error } = await supabase.from("polls").select("*").eq("trip_id", tripId);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const polls = demoRepository.getPolls(tripId);
  return NextResponse.json(polls);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const memberCheck = await assertTripMember(supabase, tripId, user.id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const dbRow: Record<string, unknown> = {
      ...toDbPatch(body),
      trip_id: tripId,
    };

    const { data, error } = await insertPollWithFallback(supabase, dbRow);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  const { v4: uuid } = await import("uuid");
  const poll = { ...body, id: uuid(), tripId } as Poll;
  demoRepository.addPoll(poll);
  return NextResponse.json(poll, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { id, patch } = (await request.json()) as {
    id: string;
    patch: Record<string, unknown>;
  };

  if (!id || !patch) {
    return NextResponse.json({ error: "id and patch are required." }, { status: 400 });
  }

  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const memberCheck = await assertTripMember(supabase, tripId, user.id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const dbPatch = toDbPatch(patch);
    const { data, error } = await updatePollWithFallback(supabase, id, tripId, dbPatch);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  demoRepository.updatePoll(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { id } = (await request.json()) as { id: string };

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const memberCheck = await assertTripMember(supabase, tripId, user.id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const { error } = await supabase.from("polls").delete().eq("id", id).eq("trip_id", tripId);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  demoRepository.deletePoll(id);
  return NextResponse.json({ ok: true });
}
