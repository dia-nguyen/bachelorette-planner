import { demoRepository } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const isSupabase = () => process.env.NEXT_PUBLIC_DATA_MODE === "supabase";

// Map camelCase domain keys → snake_case DB columns for budget_items
const FIELD_MAP: Record<string, string> = {
  title: "title",
  category: "category",
  plannedAmount: "planned_amount",
  actualAmount: "actual_amount",
  currency: "currency",
  status: "status",
  responsibleUserId: "responsible_user_id",
  paidByUserId: "paid_by_user_id",
  relatedEventId: "related_event_id",
  relatedTaskId: "related_task_id",
  notes: "notes",
  costMode: "cost_mode",
  splitType: "split_type",
  plannedSplits: "planned_splits",
  actualSplits: "actual_splits",
  splitAttendeeUserIds: "split_attendee_user_ids",
};

function toDbPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const dbKey = FIELD_MAP[key];
    if (!dbKey) continue;
    if (key === "costMode" && typeof value === "string") {
      result[dbKey] =
        value === "per_person"
          ? "PER_PERSON"
          : value === "total"
            ? "TOTAL"
            : value.toUpperCase();
    } else if (key === "splitType" && typeof value === "string") {
      result[dbKey] =
        value === "even"
          ? "EQUAL"
          : value === "custom"
            ? "CUSTOM"
            : value.toUpperCase();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { data, error } = await supabase
      .from("budget_items")
      .select("*")
      .eq("trip_id", tripId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const items = demoRepository.getBudgetItems(tripId);
  return NextResponse.json(items);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = await request.json();

  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const dbRow: Record<string, unknown> = {
      ...toDbPatch(body),
      trip_id: tripId,
    };
    if (body.id) dbRow.id = body.id;
    const { data, error } = await supabase
      .from("budget_items")
      .insert(dbRow)
      .select()
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const { v4: uuid } = await import("uuid");
  const item = { ...body, id: uuid(), tripId };
  demoRepository.addBudgetItem(item);
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const { id, patch } = (await request.json()) as {
    id: string;
    patch: Record<string, unknown>;
  };

  if (!id || !patch) {
    return NextResponse.json(
      { error: "id and patch are required." },
      { status: 400 },
    );
  }

  if (isSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const dbPatch = toDbPatch(patch);
    const { data, error } = await supabase
      .from("budget_items")
      .update(dbPatch)
      .eq("id", id)
      .eq("trip_id", tripId)
      .select()
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  demoRepository.updateBudgetItem(id, patch);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { error } = await supabase
      .from("budget_items")
      .delete()
      .eq("id", id)
      .eq("trip_id", tripId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  demoRepository.deleteBudgetItem(id);
  return NextResponse.json({ ok: true });
}
