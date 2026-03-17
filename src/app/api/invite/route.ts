import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/invite?token=xxx
 * Public — returns invite metadata (trip name, inviter) so the
 * invite page can show a preview before the user signs in.
 */
export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Invites disabled in demo mode." },
      { status: 400 },
    );
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: invite, error } = await admin
    .from("invites")
    .select("id, email, trip_id, claimed_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  // Return just enough info to render the invite page without leaking the token
  const { data: trip } = await admin
    .from("trips")
    .select("id, name, location, start_at")
    .eq("id", invite.trip_id)
    .maybeSingle();

  return NextResponse.json({
    email: invite.email,
    claimed: invite.claimed_at !== null,
    expired: new Date(invite.expires_at) < new Date(),
    trip: trip ?? null,
  });
}

/**
 * POST /api/invite
 * Authenticated. Body: { token }
 * Validates the token, checks the signed-in user's email matches the invite,
 * creates a GUEST_CONFIRMED membership, and marks the invite as claimed.
 */
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Invites disabled in demo mode." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { token: string };
  try {
    body = (await req.json()) as { token: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.claimed_at !== null) {
    return NextResponse.json(
      { error: "This invite has already been claimed." },
      { status: 409 },
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This invite has expired." },
      { status: 410 },
    );
  }

  // Email must match — case-insensitive comparison
  const userEmail = (user.email ?? "").toLowerCase();
  if (userEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${invite.email}. You are signed in as ${user.email}. Please sign in with the correct Google account.`,
      },
      { status: 403 },
    );
  }

  // Ensure the user has a users row (auto-created on first login, but guard anyway)
  await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "Guest",
    },
    { onConflict: "id" },
  );

  // Create (or update) membership
  const { error: memberError } = await admin.from("memberships").upsert(
    {
      trip_id: invite.trip_id,
      user_id: user.id,
      role: "GUEST_CONFIRMED",
      account_status: "CLAIMED",
    },
    { onConflict: "trip_id,user_id" },
  );

  if (memberError) {
    return NextResponse.json(
      { error: memberError.message || "Failed to join trip." },
      { status: 500 },
    );
  }

  // Mark invite as claimed
  await admin
    .from("invites")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, tripId: invite.trip_id });
}
