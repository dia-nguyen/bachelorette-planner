import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface DeleteRequestBody {
  userId: string;
  tripId: string;
}

export async function DELETE(req: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.json(
      { error: "Guest deletion is disabled in demo mode." },
      { status: 400 },
    );
  }

  let body: DeleteRequestBody;
  try {
    body = (await req.json()) as DeleteRequestBody;
  } catch (err) {
    console.error(`[DELETE GUEST] Failed to parse JSON body:`, err);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const tripId = body.tripId?.trim();

  if (!userId || !tripId) {
    return NextResponse.json(
      { error: "userId and tripId are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify the requesting user is an admin of the trip
  const membership = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error || membership.data?.role !== "MOH_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Only admins can delete guests." },
      { status: 403 },
    );
  }

  // Prevent self-deletion
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Check if this is an auth user or stub user via targeted lookup (avoids paginating all users).
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId);

  try {
    // Delete membership first
    const { error: membershipError } = await admin
      .from("memberships")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId);

    if (membershipError) {
      console.error(`[DELETE GUEST] Failed to delete membership:`, membershipError);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 400 },
      );
    }

    // Check if user has memberships in other trips
    const { data: otherMemberships, error: checkError } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (checkError) {
      console.error(`[DELETE GUEST] Error checking other memberships:`, checkError);
      // Continue anyway - we can leave the user record
    }

    const hasOtherMemberships = otherMemberships && otherMemberships.length > 0;

    if (!hasOtherMemberships) {
      // Safe to delete the user entirely
      const { error: userDeleteError } = await admin
        .from("users")
        .delete()
        .eq("id", userId);

      if (userDeleteError) {
        console.error(`[DELETE GUEST] Failed to delete user record:`, userDeleteError);
        // Non-fatal - membership is already deleted
      }

      // If it's an auth user, delete from auth system too
      if (authUser) {
        const { error: authDeleteError } =
          await admin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          console.error(`[DELETE GUEST] Failed to delete auth user:`, authDeleteError);
          // Non-fatal
        }
      }
    }

    return NextResponse.json({
      ok: true,
      deletedUser: !hasOtherMemberships,
      message: hasOtherMemberships
        ? "Guest removed from this trip."
        : "Guest removed from trip and account deleted.",
    });
  } catch (error) {
    console.error(`[DELETE GUEST] Unexpected error:`, error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
