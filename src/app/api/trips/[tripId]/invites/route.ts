import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

// GET /api/trips/[tripId]/invites — list all invites for the trip (admin only)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Invites disabled in demo mode." },
      { status: 400 },
    );
  }

  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify admin
  const { data: membership, error: memberErr } = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr || membership?.role !== "MOH_ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: invites, error } = await admin
    .from("invites")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }

  return NextResponse.json({ invites: invites ?? [] });
}

// POST /api/trips/[tripId]/invites — generate an invite link for an email (admin only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Invites disabled in demo mode." },
      { status: 400 },
    );
  }

  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify admin
  const { data: membership, error: memberErr } = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr || membership?.role !== "MOH_ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { email: string };
  try {
    body = (await req.json()) as { email: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  // Check if this person already has a membership (already joined)
  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.id) {
    const { data: existingMember } = await admin
      .from("memberships")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", existingProfile.id)
      .eq("account_status", "CLAIMED")
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: "This person is already a member of this trip." },
        { status: 409 },
      );
    }
  }

  // Generate a cryptographically random token (URL-safe base64, 32 bytes → 43 chars)
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Upsert invite — replace existing unclaimed invite for same email+trip
  const { data: invite, error: insertError } = await admin
    .from("invites")
    .upsert(
      {
        trip_id: tripId,
        email,
        token,
        created_by: user.id,
        expires_at: expiresAt,
        claimed_at: null,
      },
      { onConflict: "trip_id,email" },
    )
    .select()
    .single();

  if (insertError || !invite) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create invite." },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${appUrl}/invite?token=${token}`;

  return NextResponse.json({ invite, link }, { status: 201 });
}
