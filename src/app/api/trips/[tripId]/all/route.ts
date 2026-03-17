import { createAdminClient } from "@/lib/supabase/admin";
import { assertTripMember } from "@/lib/supabase/assert-trip-member";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/trips/[tripId]/all — returns ALL entity data for a trip in one response.
// Replaces 8+ parallel client-side PostgREST queries with a single server-side fetch,
// avoiding connection pool exhaustion on the Supabase free tier.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json({ error: "Use demo mode data." }, { status: 400 });
  }

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

  // Run queries in two small batches to stay within connection limits.
  const [tripRes, membershipsRes, eventsRes, tasksRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("memberships").select("*").eq("trip_id", tripId),
    supabase.from("events").select("*").eq("trip_id", tripId),
    supabase.from("tasks").select("*").eq("trip_id", tripId),
  ]);

  const [budgetRes, checklistRes, pollsRes, photosRes] = await Promise.all([
    supabase.from("budget_items").select("*").eq("trip_id", tripId),
    supabase.from("checklist_items").select("*").eq("trip_id", tripId),
    supabase.from("polls").select("*").eq("trip_id", tripId),
    supabase.from("photos").select("*").eq("trip_id", tripId),
  ]);

  // Gather member IDs from memberships + trip creator
  // Support both schema variants: user_id (current) and profile_id (legacy)
  const memberIds = new Set(
    (membershipsRes.data ?? []).map((m) => (m.user_id ?? m.profile_id) as string),
  );
  if (tripRes.data?.created_by) {
    memberIds.add(tripRes.data.created_by);
  }

  let profiles: Record<string, unknown>[] = [];
  if (memberIds.size > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id,name,email,avatar_url,custom_fields")
      .in("id", Array.from(memberIds));

    if (usersError) {
      return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }

    profiles = (users ?? []) as Record<string, unknown>[];
  }

  return NextResponse.json({
    trip: tripRes.data,
    memberships: membershipsRes.data ?? [],
    events: eventsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    budgetItems: budgetRes.data ?? [],
    checklistItems: checklistRes.data ?? [],
    polls: pollsRes.data ?? [],
    photos: photosRes.data ?? [],
    profiles,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json({ error: "Use demo mode data." }, { status: 400 });
  }

  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: membership, error: memberErr } = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: tripOwnerRow, error: ownerErr } = await supabase
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .maybeSingle();

  const isAdminMember = !memberErr && membership?.role === "MOH_ADMIN";
  const isTripOwner = !ownerErr && tripOwnerRow?.created_by === user.id;

  if (!isAdminMember && !isTripOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { guestFieldSchema?: unknown };
  try {
    body = (await request.json()) as { guestFieldSchema?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.guestFieldSchema)) {
    return NextResponse.json({ error: "guestFieldSchema must be an array." }, { status: 400 });
  }

  const allowedTypes = new Set(["text", "tel", "number", "date", "textarea"]);
  const normalizedSchema: Array<{ id: string; label: string; type: string }> = [];
  for (const field of body.guestFieldSchema) {
    if (!field || typeof field !== "object") {
      return NextResponse.json({ error: "Each guest field must be an object." }, { status: 400 });
    }
    const typed = field as Record<string, unknown>;
    const id = String(typed.id ?? "").trim();
    const label = String(typed.label ?? "").trim();
    const type = String(typed.type ?? "").trim();
    if (!id || !label || !allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Each guest field must include valid id, label, and type." },
        { status: 400 },
      );
    }
    normalizedSchema.push({ id, label, type });
  }

  const admin = createAdminClient();
  const { data: tripRow, error: updateError } = await admin
    .from("trips")
    .update({ guest_field_schema: normalizedSchema })
    .eq("id", tripId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trip: tripRow });
}
