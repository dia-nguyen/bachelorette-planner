import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface InviteRequestBody {
  email: string;
  name: string;
  tripId: string;
  action?: "add" | "invite";
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Invites are disabled in demo mode." },
      { status: 400 },
    );
  }

  let body: InviteRequestBody;
  try {
    body = (await req.json()) as InviteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const tripId = body.tripId?.trim();
  const action = body.action === "add" ? "add" : "invite";

  if (!email || !name || !tripId) {
    return NextResponse.json(
      { error: "email, name, and tripId are required." },
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

  const membership = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (membership.error || membership.data?.role !== "MOH_ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let profileId = existingProfile?.id;

  if (!profileId) {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { name },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: createUserError?.message || "Failed to create guest user." },
        { status: 400 },
      );
    }

    profileId = createdUser.user.id;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: profileId,
        email,
        name,
        is_verified: false,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "Failed to create guest profile." },
        { status: 400 },
      );
    }
  }

  const { error: membershipUpsertError } = await admin
    .from("memberships")
    .upsert(
      {
        trip_id: tripId,
        profile_id: profileId,
        role: "GUEST_CONFIRMED",
        invite_status: action === "invite" ? "PENDING" : "ACCEPTED",
        invited_at: action === "invite" ? new Date().toISOString() : null,
      },
      { onConflict: "trip_id,profile_id" },
    );

  if (membershipUpsertError) {
    return NextResponse.json(
      {
        error: membershipUpsertError.message || "Failed to add guest to trip.",
      },
      { status: 400 },
    );
  }

  if (action === "invite") {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${new URL(req.url).origin}/auth/callback`,
        data: {
          invited_trip_id: tripId,
          invited_name: name,
        },
      },
    );

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message || "Failed to send invite." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true, action });
}
