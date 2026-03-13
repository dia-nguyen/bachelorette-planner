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

  // Gather profile IDs from memberships + trip creator
  const memberProfileIds = new Set(
    (membershipsRes.data ?? []).map((m) => m.profile_id as string),
  );
  if (tripRes.data?.created_by) {
    memberProfileIds.add(tripRes.data.created_by);
  }

  let profiles: Record<string, unknown>[] = [];
  if (memberProfileIds.size > 0) {
    const profilesRes = await supabase
      .from("profiles")
      .select("id,name,email,avatar_color,custom_fields")
      .in("id", Array.from(memberProfileIds));
    profiles = (profilesRes.data ?? []) as Record<string, unknown>[];
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
