import { demoRepository } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const memberships = demoRepository.getMemberships(tripId);
  const users = demoRepository.getUsers(tripId);
  const result = memberships.map((m) => {
    const user = users.find((u) => u.id === m.userId);
    return { ...m, user };
  });
  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = await request.json();
  const { v4: uuid } = await import("uuid");
  const userId = uuid();
  demoRepository.addUser({
    id: userId,
    name: body.name,
    email: body.email,
    avatarColor:
      "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0"),
  });
  demoRepository.addMembership({
    tripId,
    userId,
    role: "GUEST_CONFIRMED",
    accountStatus: "INVITED",
  });
  return NextResponse.json({ tripId, userId }, { status: 201 });
}
