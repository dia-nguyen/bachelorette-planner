import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        name,
        avatar_url: avatarUrl,
        is_verified: true,
      },
      { onConflict: "id" },
    );
  }

  // Redirect to the intended destination (preserves invite token redemption on /invite?token=...)
  return NextResponse.redirect(new URL(next, request.url));
}
