import { demoRepository } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const events = demoRepository.getEvents(tripId);
  return NextResponse.json(events);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = await request.json();
  const { v4: uuid } = await import("uuid");
  const event = { ...body, id: uuid(), tripId };
  demoRepository.addEvent(event);
  return NextResponse.json(event, { status: 201 });
}
