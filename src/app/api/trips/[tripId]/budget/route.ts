import { demoRepository } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const items = demoRepository.getBudgetItems(tripId);
  return NextResponse.json(items);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = await request.json();
  const { v4: uuid } = await import("uuid");
  const item = { ...body, id: uuid(), tripId };
  demoRepository.addBudgetItem(item);
  return NextResponse.json(item, { status: 201 });
}
