import { demoRepository } from "@/lib/data";
import { computeDashboard } from "@/lib/domain";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
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
