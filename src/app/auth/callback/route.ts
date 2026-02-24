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

    await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        name: user.user_metadata?.name ?? user.email ?? "Guest",
        is_verified: true,
      },
      { onConflict: "id" },
    );

    await supabase
      .from("memberships")
      .update({
        claimed_at: new Date().toISOString(),
        invite_status: "ACCEPTED",
      })
      .eq("profile_id", user.id)
      .eq("invite_status", "PENDING");
  }

  return NextResponse.redirect(new URL(next, request.url));
}
