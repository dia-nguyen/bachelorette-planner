import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface StubUserRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  custom_fields: Record<string, string> | null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

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
    const name =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Guest";
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

    const { error: upsertError } = await admin.from("users").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        name: name || stubUser?.name || "Guest",
        avatar_url: avatarUrl ?? stubUser?.avatar_url ?? null,
        custom_fields: stubUser?.custom_fields ?? {},
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      console.error("[auth/callback] Failed to upsert real user row:", upsertError.message);
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (stubUser) {
        // Transfer all memberships from stub → real user
        const { error: transferError } = await admin
          .from("memberships")
          .update({ user_id: user.id, account_status: "CLAIMED" })
          .eq("user_id", stubUser.id);

        if (transferError) {
          console.error(
            "[auth/callback] Failed to transfer memberships from stub user:",
            transferError.message,
          );
          return NextResponse.redirect(new URL(next, request.url));
        }

        // Delete stub user row and stub auth user
        const { error: deleteUserRowError } = await admin
          .from("users")
          .delete()
          .eq("id", stubUser.id);

        if (deleteUserRowError) {
          console.error(
            "[auth/callback] Failed to delete stub user row after transfer:",
            deleteUserRowError.message,
          );
          return NextResponse.redirect(new URL(next, request.url));
        }

        const { error: deleteAuthUserError } = await admin.auth.admin.deleteUser(stubUser.id);
        if (deleteAuthUserError) {
          console.error(
            "[auth/callback] Failed to delete stub auth user after transfer:",
            deleteAuthUserError.message,
          );
        }
    }

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
