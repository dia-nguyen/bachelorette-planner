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
  isPublished: "is_published",
  maxVotesPerUser: "max_votes_per_user",
  visibility: "visibility",
  requiredUserIds: "required_user_ids",
  createdAt: "created_at",
};

function stripPublishField<T extends Record<string, unknown>>(poll: T): Omit<T, "is_published"> {
  // Non-admin clients don't need visibility into publish state.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { is_published, ...rest } = poll;
  return rest;
}

async function isTripAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  userId: string,
  role: string,
) {
  if (role === "MOH_ADMIN") return true;
  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .maybeSingle();
  if (error) return false;
  return tripRow?.created_by === userId;
}

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

  const unsupported = ["visibility", "required_user_ids", "is_published"];
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
    const canManage = await isTripAdmin(supabase, tripId, user.id, memberCheck.role);
    const { data, error } = await supabase.from("polls").select("*").eq("trip_id", tripId);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    if (canManage) return NextResponse.json(data);

    const visiblePolls = (data ?? [])
      .filter((poll) => Boolean(poll.is_published ?? true))
      .map(stripPublishField);
    return NextResponse.json(visiblePolls);
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
    const canManage = await isTripAdmin(supabase, tripId, user.id, memberCheck.role);
    if (!canManage) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const dbRow: Record<string, unknown> = {
      ...toDbPatch(body),
      trip_id: tripId,
    };
    if (!("is_published" in dbRow)) {
      dbRow.is_published = false;
    }

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
    const canManage = await isTripAdmin(supabase, tripId, user.id, memberCheck.role);

    if (canManage) {
      const dbPatch = toDbPatch(patch);
      const { data, error } = await updatePollWithFallback(supabase, id, tripId, dbPatch);
      if (error) {
        return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    const patchKeys = Object.keys(patch);
    if (patchKeys.length !== 1 || patchKeys[0] !== "options") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: existingPoll, error: existingError } = await supabase
      .from("polls")
      .select("id,options,is_closed,is_published,max_votes_per_user")
      .eq("id", id)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (existingError || !existingPoll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }
    if (existingPoll.is_closed || !Boolean(existingPoll.is_published ?? true)) {
      return NextResponse.json({ error: "This poll is not open for voting." }, { status: 403 });
    }

    const previousOptions = Array.isArray(existingPoll.options) ? existingPoll.options : [];
    const requestedOptions = Array.isArray(patch.options) ? patch.options : [];
    const maxVotesPerUser = Number.isFinite(existingPoll.max_votes_per_user)
      ? Math.max(1, Math.floor(existingPoll.max_votes_per_user as number))
      : 1;
    const selectedIds = new Set(
      requestedOptions
        .filter((option) => option && typeof option === "object")
        .map((option) => {
          const typed = option as { id?: unknown; voterUserIds?: unknown };
          if (typeof typed.id !== "string") return null;
          if (!Array.isArray(typed.voterUserIds) || !typed.voterUserIds.includes(user.id)) return null;
          return typed.id;
        })
        .filter((id): id is string => Boolean(id)),
    );
    const allowedOptionIds = new Set(
      previousOptions
        .filter((option) => option && typeof option === "object")
        .map((option) => (typeof option.id === "string" ? option.id : null))
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of selectedIds) {
      if (!allowedOptionIds.has(id)) {
        return NextResponse.json({ error: "Invalid vote option." }, { status: 400 });
      }
    }
    if (selectedIds.size > maxVotesPerUser) {
      return NextResponse.json({ error: `You can select up to ${maxVotesPerUser} options.` }, { status: 400 });
    }

    const nextOptions = previousOptions.map((option) => {
      const existingVoters = Array.isArray(option?.voterUserIds) ? option.voterUserIds as string[] : [];
      const withoutMe = existingVoters.filter((voterId) => voterId !== user.id);
      if (option?.id && selectedIds.has(option.id)) {
        return { ...option, voterUserIds: [...withoutMe, user.id] };
      }
      return { ...option, voterUserIds: withoutMe };
    });

    const { data, error } = await updatePollWithFallback(supabase, id, tripId, { options: nextOptions });
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json(stripPublishField(data));
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
    const canManage = await isTripAdmin(supabase, tripId, user.id, memberCheck.role);
    if (!canManage) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const { error } = await supabase.from("polls").delete().eq("id", id).eq("trip_id", tripId);
    if (error) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  demoRepository.deletePoll(id);
  return NextResponse.json({ ok: true });
}
