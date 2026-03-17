import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/me — returns the authenticated user's profile + admin status
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

  // Sequential queries to avoid connection pool exhaustion
  const profileRes = await supabase
    .from("users")
    .select("is_verified")
    .eq("id", user.id)
    .maybeSingle();

  const tripRes = await supabase
    .from("trips")
    .select("id")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();

  const isVerified = Boolean(profileRes.data?.is_verified);
  const isAdmin = Boolean(tripRes.data);
  const role = isAdmin ? "MOH_ADMIN" : "GUEST_CONFIRMED";

  return NextResponse.json({ isVerified, isAdmin, role });
}
