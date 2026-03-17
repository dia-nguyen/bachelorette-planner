import { demoRepository } from "@/lib/data";
import { computeDashboard } from "@/lib/domain";
import { assertTripMember } from "@/lib/supabase/assert-trip-member";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
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

    const memberCheck = await assertTripMember(supabase, tripId, user.id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    // Dashboard is computed client-side from the /all endpoint in supabase mode.
    // This route is only used in demo mode; return a 400 to avoid confusion.
    return NextResponse.json(
      { error: "Use /api/trips/[tripId]/all in supabase mode." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "u1";

  const trip = demoRepository.getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const memberships = demoRepository.getMemberships(tripId);
  const users = demoRepository.getUsers(tripId);
  const events = demoRepository.getEvents(tripId);
  const tasks = demoRepository.getTasks(tripId);
  const budgetItems = demoRepository.getBudgetItems(tripId);

  const data = computeDashboard(
    trip,
    memberships,
    users,
    events,
    tasks,
    budgetItems,
    userId,
  );

  return NextResponse.json(data);
}
