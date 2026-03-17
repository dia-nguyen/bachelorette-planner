import { demoRepository } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const isSupabase = () => process.env.NEXT_PUBLIC_DATA_MODE === "supabase";

// Map camelCase domain keys → snake_case DB columns for events
const FIELD_MAP: Record<string, string> = {
  title: "title",
  description: "description",
  startAt: "start_at",
  endAt: "end_at",
  location: "location",
  status: "status",
  provider: "provider",
  confirmationCode: "confirmation_code",
  attendeeUserIds: "attendee_user_ids",
};

function toDbPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const dbKey = FIELD_MAP[key];
    if (!dbKey) continue;
    if (key === "status" && typeof value === "string") {
      result[dbKey] = value === "CANCELED" ? "CANCELLED" : value;
    } else {
      result[dbKey] = value;
    }
  }
  return result;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  if (isSupabase()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { data, error } = await supabase.from("events").select("*").eq("trip_id", tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const events = demoRepository.getEvents(tripId);
  return NextResponse.json(events);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = await request.json();

  if (isSupabase()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const dbRow: Record<string, unknown> = { ...toDbPatch(body), trip_id: tripId };
    if (body.id) dbRow.id = body.id;
    const { data, error } = await supabase.from("events").insert(dbRow).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const { v4: uuid } = await import("uuid");
  const event = { ...body, id: uuid(), tripId };
  demoRepository.addEvent(event);
  return NextResponse.json(event, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { id, patch } = (await request.json()) as { id: string; patch: Record<string, unknown> };

  if (!id || !patch) {
    return NextResponse.json({ error: "id and patch are required." }, { status: 400 });
  }

  if (isSupabase()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const dbPatch = toDbPatch(patch);
    const { data, error } = await supabase
      .from("events")
      .update(dbPatch)
      .eq("id", id)
      .eq("trip_id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  demoRepository.updateEvent(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { id } = (await request.json()) as { id: string };

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (isSupabase()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { error } = await supabase.from("events").delete().eq("id", id).eq("trip_id", tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  demoRepository.deleteEvent(id);
  return NextResponse.json({ ok: true });
}
