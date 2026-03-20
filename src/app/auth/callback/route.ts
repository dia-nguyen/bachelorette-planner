import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface StubUserRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  custom_fields: Record<string, string> | null;
}

interface ExistingUserRow {
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  custom_fields: Record<string, string> | null;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeCustomFields(
  value: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entryValue]) =>
        typeof key === "string" &&
        key.length > 0 &&
        typeof entryValue === "string",
    ),
  );
}

async function migrateScalarUserReference(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  column: string,
  stubId: string,
  realUserId: string,
): Promise<void> {
  const { error } = await admin
    .from(table)
    .update({ [column]: realUserId })
    .eq(column, stubId);

  if (error) {
    console.error(
      `[auth/callback] Failed to migrate ${table}.${column} references:`,
      error.message,
    );
  }
}

async function migrateArrayUserReference(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  idColumn: string,
  arrayColumn: string,
  stubId: string,
  realUserId: string,
): Promise<void> {
  const { data: rows, error } = await admin
    .from(table)
    .select(`${idColumn}, ${arrayColumn}`)
    .contains(arrayColumn, [stubId]);

  if (error) {
    console.error(
      `[auth/callback] Failed to load ${table}.${arrayColumn} references:`,
      error.message,
    );
    return;
  }

  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const rowId = row[idColumn];
    const current = Array.isArray(row[arrayColumn]) ? (row[arrayColumn] as string[]) : [];
    const next = current.map((userId) => (userId === stubId ? realUserId : userId));
    const deduped = [...new Set(next)];

    const { error: updateError } = await admin
      .from(table)
      .update({ [arrayColumn]: deduped })
      .eq(idColumn, rowId);

    if (updateError) {
      console.error(
        `[auth/callback] Failed to update ${table}.${arrayColumn} for row ${String(rowId)}:`,
        updateError.message,
      );
    }
  }
}

async function migrateStubReferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  stubId: string,
  realUserId: string,
): Promise<void> {
  await Promise.all([
    migrateArrayUserReference(admin, "tasks", "id", "assignee_user_ids", stubId, realUserId),
    migrateArrayUserReference(admin, "events", "id", "attendee_user_ids", stubId, realUserId),
    migrateArrayUserReference(
      admin,
      "budget_items",
      "id",
      "split_attendee_user_ids",
      stubId,
      realUserId,
    ),
    migrateScalarUserReference(
      admin,
      "budget_items",
      "responsible_user_id",
      stubId,
      realUserId,
    ),
    migrateScalarUserReference(admin, "budget_items", "paid_by_user_id", stubId, realUserId),
    migrateScalarUserReference(
      admin,
      "checklist_items",
      "assignee_user_id",
      stubId,
      realUserId,
    ),
    migrateScalarUserReference(admin, "polls", "created_by_user_id", stubId, realUserId),
    migrateScalarUserReference(admin, "photos", "uploaded_by_user_id", stubId, realUserId),
  ]);
}

// Transfer memberships from a stub user to the real user, then delete the stub.
// Handles the case where the real user already has a membership in the same trip
// (e.g. from a previous partial merge) by deleting the conflicting stub membership
// instead of transferring it.
async function mergeStubIntoUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  stubId: string,
  realUserId: string,
): Promise<void> {
  await migrateStubReferences(admin, stubId, realUserId);

  const { data: stubMemberships } = await admin
    .from("memberships")
    .select("id, trip_id")
    .eq("user_id", stubId);

  if (stubMemberships && stubMemberships.length > 0) {
    // Find trips where the real user already has a membership (unique constraint conflict).
    const tripIds = stubMemberships.map((m: { trip_id: string }) => m.trip_id);
    const { data: existing } = await admin
      .from("memberships")
      .select("trip_id")
      .eq("user_id", realUserId)
      .in("trip_id", tripIds);

    const existingTripIds = new Set(
      (existing ?? []).map((m: { trip_id: string }) => m.trip_id),
    );

    // Memberships where real user already exists — just delete the stub's copy.
    const conflictIds = stubMemberships
      .filter((m: { trip_id: string }) => existingTripIds.has(m.trip_id))
      .map((m: { id: string }) => m.id);
    if (conflictIds.length > 0) {
      const { error } = await admin.from("memberships").delete().in("id", conflictIds);
      if (error) {
        console.error("[auth/callback] Failed to delete conflicting stub memberships:", error.message);
      }
    }

    // Remaining memberships — transfer to real user and mark CLAIMED.
    const transferIds = stubMemberships
      .filter((m: { trip_id: string }) => !existingTripIds.has(m.trip_id))
      .map((m: { id: string }) => m.id);
    if (transferIds.length > 0) {
      const { error } = await admin
        .from("memberships")
        .update({ user_id: realUserId, account_status: "CLAIMED" })
        .in("id", transferIds);
      if (error) {
        console.error("[auth/callback] Failed to transfer memberships from stub:", error.message);
      }
    }
  }

  // Delete stub user row. Don't return early on failure — log and continue so the
  // user's login is not blocked by a cleanup error.
  const { error: deleteRowError } = await admin.from("users").delete().eq("id", stubId);
  if (deleteRowError) {
    console.error("[auth/callback] Failed to delete stub user row:", deleteRowError.message);
    return;
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(stubId);
  if (deleteAuthError) {
    console.error("[auth/callback] Failed to delete stub auth user:", deleteAuthError.message);
  }
}

// Find and clean up any previously-orphaned stubs (email = merged-*@placeholder.internal)
// that share a trip with the given user. These are leftovers from a prior partial merge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanOrphanedStubs(admin: any, userId: string): Promise<void> {
  const { data: userMemberships } = await admin
    .from("memberships")
    .select("trip_id")
    .eq("user_id", userId);

  if (!userMemberships || userMemberships.length === 0) return;

  const tripIds = userMemberships.map((m: { trip_id: string }) => m.trip_id);

  // Find memberships in those trips belonging to OTHER users.
  const { data: siblingMemberships } = await admin
    .from("memberships")
    .select("id, user_id")
    .in("trip_id", tripIds)
    .neq("user_id", userId);

  if (!siblingMemberships || siblingMemberships.length === 0) return;

  const otherUserIds = [...new Set(siblingMemberships.map((m: { user_id: string }) => m.user_id))];

  // Filter to only those with a placeholder email (orphaned stubs).
  const { data: orphans } = await admin
    .from("users")
    .select("id")
    .in("id", otherUserIds)
    .like("email", "merged-%@placeholder.internal");

  if (!orphans || orphans.length === 0) return;

  for (const orphan of orphans as { id: string }[]) {
    console.error(`[auth/callback] Cleaning up orphaned stub ${orphan.id}`);
    await admin.from("memberships").delete().eq("user_id", orphan.id);
    await admin.from("users").delete().eq("id", orphan.id);
    await admin.auth.admin.deleteUser(orphan.id);
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Validate next is a safe relative path to prevent open redirect attacks.
  // Reject empty paths, absolute URLs (//evil.com), and anything not starting with /.
  const rawNext = requestUrl.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();

    // Pull name and avatar from Google OAuth metadata
    const metadataName = pickFirstNonEmpty(
      user.user_metadata?.full_name,
      user.user_metadata?.name,
    );
    const avatarUrl =
      user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;

    // Check for a stub profile with the same email (created when admin added this guest).
    // If found, transfer all memberships from the stub to the real user, then delete the stub.
    let stubUser: StubUserRow | null = null;

    if (user.email) {
      const { data: matchedStubUser } = await admin
        .from("users")
        .select("id,name,avatar_url,custom_fields")
        .eq("email", user.email)
        .neq("id", user.id)
        .maybeSingle();

      stubUser = matchedStubUser as StubUserRow | null;
    }

    if (stubUser) {
      const placeholderEmail = `merged-${stubUser.id}@placeholder.internal`;
      const { error: detachStubError } = await admin
        .from("users")
        .update({ email: placeholderEmail })
        .eq("id", stubUser.id);

      if (detachStubError) {
        console.error(
          "[auth/callback] Failed to detach stub email before merge:",
          detachStubError.message,
        );
        return NextResponse.redirect(new URL(next, request.url));
      }
    }

    const { data: existingUser } = await admin
      .from("users")
      .select("email,name,avatar_url,custom_fields")
      .eq("id", user.id)
      .maybeSingle();

    const existingUserRow = (existingUser ?? null) as ExistingUserRow | null;
    const existingCustomFields = normalizeCustomFields(existingUserRow?.custom_fields);
    const stubCustomFields = normalizeCustomFields(stubUser?.custom_fields);
    const mergedCustomFields = {
      ...existingCustomFields,
      ...stubCustomFields,
    };

    const resolvedEmail =
      pickFirstNonEmpty(user.email, existingUserRow?.email) ?? "";
    const resolvedName =
      pickFirstNonEmpty(
        metadataName,
        existingUserRow?.name,
        stubUser?.name,
        user.email?.split("@")[0],
      ) ?? "Guest";
    const resolvedAvatarUrl =
      avatarUrl ?? existingUserRow?.avatar_url ?? stubUser?.avatar_url ?? null;

    const { error: upsertError } = await admin.from("users").upsert(
      {
        id: user.id,
        email: resolvedEmail.toLowerCase(),
        name: resolvedName,
        avatar_url: resolvedAvatarUrl,
        custom_fields: mergedCustomFields,
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      console.error("[auth/callback] Failed to upsert real user row:", upsertError.message);
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (stubUser) {
      await mergeStubIntoUser(admin, stubUser.id, user.id);
    }

    // Clean up any previously-orphaned stubs (merged-*@placeholder.internal) in the
    // same trips as this user. These are left over from a partially-completed prior merge.
    await cleanOrphanedStubs(admin, user.id);

    // Ensure invited users are auto-claimed as soon as they complete login.
    const { error: claimError } = await admin
      .from("memberships")
      .update({ account_status: "CLAIMED" })
      .eq("user_id", user.id)
      .neq("account_status", "CLAIMED");

    if (claimError) {
      console.error("[auth/callback] Failed to auto-claim memberships:", claimError.message);
    }
  }

  // Redirect to the intended destination (preserves invite token redemption on /invite?token=...)
  return NextResponse.redirect(new URL(next, request.url));
}
