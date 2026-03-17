import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Verifies that userId holds any membership in tripId.
 * Returns the membership row ({ role }) on success, or a 403 NextResponse on failure.
 * Callers must check `result instanceof NextResponse` and return early if so.
 */
export async function assertTripMember(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<{ role: string } | NextResponse> {
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !membership) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return membership as { role: string };
}
