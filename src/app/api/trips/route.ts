import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/trips — returns all trips the authenticated user is a member of or created
export async function GET() {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json({ error: "Use demo mode data." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Get all trips via memberships + trips created by user
  const [membershipRows, createdTripRows] = await Promise.all([
    supabase.from("memberships").select("trip_id").eq("user_id", user.id),
    supabase.from("trips").select("*").eq("created_by", user.id),
  ]);

  const memberTripIds = (membershipRows.data ?? []).map(
    (m) => m.trip_id as string,
  );

  const allTrips = (createdTripRows.data ?? []) as Record<string, unknown>[];

  if (memberTripIds.length > 0) {
    const memberTripsRes = await supabase
      .from("trips")
      .select("*")
      .in("id", memberTripIds);

    for (const row of memberTripsRes.data ?? []) {
      if (!allTrips.some((t) => t.id === row.id)) {
        allTrips.push(row as Record<string, unknown>);
      }
    }
  }

  // Sort most recent first by start_at
  allTrips.sort((a, b) =>
    String(b.start_at ?? "").localeCompare(String(a.start_at ?? "")),
  );

  return NextResponse.json({ trips: allTrips });
}

// POST /api/trips — creates a new trip and auto-assigns the creator as MOH_ADMIN
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json({ error: "Use demo mode data." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    name: string;
    location: string;
    startAt: string;
    endAt: string;
    description?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, location, startAt, endAt, description } = body;
  if (!name?.trim() || !startAt || !endAt) {
    return NextResponse.json(
      { error: "name, startAt, and endAt are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Generate a high-entropy join code (~7.2×10²¹ possibilities with 12 base64url chars).
  const joinCode = randomBytes(8).toString("base64url").substring(0, 12).toUpperCase();

  // Insert the trip
  const { data: tripRow, error: tripError } = await admin
    .from("trips")
    .insert({
      name: name.trim(),
      location: location?.trim() ?? "",
      start_at: startAt,
      end_at: endAt,
      description: description?.trim() ?? null,
      join_code: joinCode,
      created_by: user.id,
    })
    .select()
    .single();

  if (tripError || !tripRow) {
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }

  // Auto-assign creator as MOH_ADMIN
  await admin.from("memberships").insert({
    trip_id: tripRow.id,
    user_id: user.id,
    role: "MOH_ADMIN",
    account_status: "CLAIMED",
  });

  return NextResponse.json({ trip: tripRow }, { status: 201 });
}
