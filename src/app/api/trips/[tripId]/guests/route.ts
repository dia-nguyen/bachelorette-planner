import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { demoRepository } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [membershipsRes, usersRes] = await Promise.all([
      supabase.from("memberships").select("*").eq("trip_id", tripId),
      supabase.from("users").select("id,name,email,avatar_url,custom_fields"),
    ]);

    if (membershipsRes.error) {
      return NextResponse.json({ error: membershipsRes.error.message }, { status: 500 });
    }

    if (usersRes.error) {
      return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
    }

    const usersById = new Map((usersRes.data ?? []).map((row) => [row.id, row]));
    const result = (membershipsRes.data ?? []).map((membership) => ({
      ...membership,
      user: usersById.get((membership.user_id ?? membership.profile_id) as string) ?? null,
    }));

    return NextResponse.json(result);
  }

  const memberships = demoRepository.getMemberships(tripId);
  const users = demoRepository.getUsers(tripId);
  const result = memberships.map((m) => {
    const user = users.find((u) => u.id === m.userId);
    return { ...m, user };
  });
  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as { name?: string; email?: string };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required." }, { status: 400 });
  }

  // ---- Supabase mode ----
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if a user with this email already exists (real user or previous stub)
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      // User exists — just ensure they have a membership for this trip
      const { data: existingMember } = await admin
        .from("memberships")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: "This person is already a member of this trip." }, { status: 409 });
      }

      await admin.from("memberships").insert({
        trip_id: tripId,
        user_id: existingUser.id,
        role: "GUEST_CONFIRMED",
        account_status: "INVITED",
      });

      return NextResponse.json({ tripId, userId: existingUser.id }, { status: 201 });
    }

    // No app user yet — create a stub auth user so we have an auth UID to attach
    // to the users row and membership before the guest logs in for the first time.
    const { v4: uuidv4 } = await import("uuid");
    const stubId = uuidv4();
    const placeholderEmail = `stub-${stubId}@placeholder.internal`;

    const { error: authErr } = await admin.auth.admin.createUser({
      id: stubId,
      email: placeholderEmail,
      email_confirm: true,
      user_metadata: { name, is_stub: true },
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    // The auth.users -> public.users trigger creates the row on stub auth user creation.
    // Upsert here to replace the placeholder values with the real guest-facing fields.
    const { error: userErr } = await admin.from("users").upsert(
      {
        id: stubId,
        email,
        name,
      },
      { onConflict: "id" },
    );

    if (userErr) {
      // Clean up the auth user if insert fails
      await admin.auth.admin.deleteUser(stubId);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    // Create membership
    const { error: memberErr } = await admin.from("memberships").insert({
      trip_id: tripId,
      user_id: stubId,
      role: "GUEST_CONFIRMED",
      account_status: "INVITED",
    });

    if (memberErr) {
      await admin.from("users").delete().eq("id", stubId);
      await admin.auth.admin.deleteUser(stubId);
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    return NextResponse.json({ tripId, userId: stubId }, { status: 201 });
  }

  // ---- Demo mode ----
  const { v4: uuid } = await import("uuid");
  const userId = uuid();
  demoRepository.addUser({
    id: userId,
    name,
    email,
    avatarColor:
      "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0"),
  });
  demoRepository.addMembership({
    tripId,
    userId,
    role: "GUEST_CONFIRMED",
    accountStatus: "INVITED",
  });
  return NextResponse.json({ tripId, userId }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { userId, patch } = (await request.json()) as {
    userId?: string;
    patch?: Record<string, unknown>;
  };

  if (!userId || !patch) {
    return NextResponse.json({ error: "userId and patch are required." }, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = createAdminClient();
    const userPatch: Record<string, unknown> = {};
    if (typeof patch.name === "string") userPatch.name = patch.name.trim();
    if (typeof patch.email === "string") userPatch.email = patch.email.trim().toLowerCase();
    if (patch.custom_fields && typeof patch.custom_fields === "object") {
      userPatch.custom_fields = patch.custom_fields;
    }

    if (Object.keys(userPatch).length > 0) {
      const { error: userError } = await admin
        .from("users")
        .update(userPatch)
        .eq("id", userId);

      if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }
    }

    const membershipPatch: Record<string, unknown> = {};
    if (typeof patch.role === "string") membershipPatch.role = patch.role;
    if (typeof patch.account_status === "string") {
      membershipPatch.account_status = patch.account_status;
    } else if (typeof patch.invite_status === "string") {
      membershipPatch.account_status =
        patch.invite_status === "ACCEPTED" ? "CLAIMED" : "INVITED";
    }

    if (Object.keys(membershipPatch).length > 0) {
      const { error: membershipError } = await admin
        .from("memberships")
        .update(membershipPatch)
        .eq("trip_id", tripId)
        .eq("user_id", userId);

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  const userPatch: Record<string, unknown> = {};
  if (typeof patch.name === "string") userPatch.name = patch.name;
  if (typeof patch.email === "string") userPatch.email = patch.email;
  if (patch.custom_fields && typeof patch.custom_fields === "object") {
    userPatch.customFields = patch.custom_fields;
  }
  if (Object.keys(userPatch).length > 0) {
    demoRepository.updateUser(userId, userPatch);
  }

  const membershipPatch: Record<string, unknown> = {};
  if (typeof patch.role === "string") membershipPatch.role = patch.role;
  if (typeof patch.account_status === "string") {
    membershipPatch.accountStatus = patch.account_status;
  } else if (typeof patch.invite_status === "string") {
    membershipPatch.accountStatus =
      patch.invite_status === "ACCEPTED" ? "CLAIMED" : "INVITED";
  }
  if (Object.keys(membershipPatch).length > 0) {
    demoRepository.updateMembership(tripId, userId, membershipPatch);
  }

  return NextResponse.json({ ok: true });
}
