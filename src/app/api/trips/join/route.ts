import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/trips/join — join a trip using its join code
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

  let body: { code: string };
  try {
    body = (await req.json()) as { code: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "code is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select("id, name")
    .eq("join_code", code)
    .maybeSingle();

  if (!trip) {
    return NextResponse.json(
      { error: "Trip not found. Check the code and try again." },
      { status: 404 },
    );
  }

  // Ensure the joining user has a profile row
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "Guest",
      avatar_url:
        user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      is_verified: true,
    },
    { onConflict: "id" },
  );

  // Create membership — upsert so rejoining is idempotent
  const { error: memberError } = await admin.from("memberships").upsert(
    {
      trip_id: trip.id,
      profile_id: user.id,
      role: "GUEST_PENDING",
      invite_status: "ACCEPTED",
    },
    { onConflict: "trip_id,profile_id" },
  );

  if (memberError) {
    return NextResponse.json(
      { error: memberError.message || "Failed to join trip." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, tripId: trip.id });
}
