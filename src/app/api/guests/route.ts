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
    console.log(`[DELETE GUEST] Request received:`, {
      userId: body.userId,
      tripId: body.tripId,
    });
  } catch (err) {
    console.error(`[DELETE GUEST] Failed to parse JSON body:`, err);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const tripId = body.tripId?.trim();

  if (!userId || !tripId) {
    console.error(`[DELETE GUEST] Missing required fields:`, {
      userId: !!userId,
      tripId: !!tripId,
    });
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
    console.error(`[DELETE GUEST] No authenticated user found`);
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  console.log(`[DELETE GUEST] Authenticated user: ${user.id}`);

  // Verify the requesting user is an admin of the trip
  const membership = await supabase
    .from("memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership.error || membership.data?.role !== "MOH_ADMIN") {
    console.error(`[DELETE GUEST] Authorization failed:`, {
      error: membership.error?.message,
      role: membership.data?.role,
    });
    return NextResponse.json(
      { error: "Forbidden. Only admins can delete guests." },
      { status: 403 },
    );
  }

  // Prevent self-deletion
  if (userId === user.id) {
    console.error(`[DELETE GUEST] User attempted to delete themselves`);
    return NextResponse.json(
      { error: "Cannot delete your own account." },
      { status: 400 },
    );
  }

  console.log(`[DELETE GUEST] User authorized as MOH_ADMIN`);

  const admin = createAdminClient();

  // Check if this is an auth user or stub user
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const authUser = authUsers?.users.find((u) => u.id === userId);

  console.log(
    `[DELETE GUEST] Target user is ${authUser ? "auth user" : "stub user"}`,
  );

  try {
    // Delete membership first
    console.log(
      `[DELETE GUEST] Removing membership for user ${userId} from trip ${tripId}`,
    );
    const { error: membershipError } = await admin
      .from("memberships")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId);

    if (membershipError) {
      console.error(
        `[DELETE GUEST] Failed to delete membership:`,
        membershipError,
      );
      return NextResponse.json(
        {
          error: `Failed to remove guest from trip: ${membershipError.message}`,
        },
        { status: 400 },
      );
    }

    console.log(`[DELETE GUEST] Membership deleted`);

    // Check if user has memberships in other trips
    const { data: otherMemberships, error: checkError } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (checkError) {
      console.error(
        `[DELETE GUEST] Error checking other memberships:`,
        checkError,
      );
      // Continue anyway - we can leave the user record
    }

    const hasOtherMemberships = otherMemberships && otherMemberships.length > 0;
    console.log(
      `[DELETE GUEST] User has other memberships: ${hasOtherMemberships}`,
    );

    if (!hasOtherMemberships) {
      // Safe to delete the user entirely
      console.log(`[DELETE GUEST] Deleting user record for ${userId}`);

      const { error: userDeleteError } = await admin
        .from("users")
        .delete()
        .eq("id", userId);

      if (userDeleteError) {
        console.error(
          `[DELETE GUEST] Failed to delete user record:`,
          userDeleteError,
        );
        // Non-fatal - membership is already deleted
      } else {
        console.log(`[DELETE GUEST] User record deleted`);
      }

      // If it's an auth user, delete from auth system too
      if (authUser) {
        console.log(`[DELETE GUEST] Deleting auth user ${userId}`);
        const { error: authDeleteError } =
          await admin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          console.error(
            `[DELETE GUEST] Failed to delete auth user:`,
            authDeleteError,
          );
          // Non-fatal
        } else {
          console.log(`[DELETE GUEST] Auth user deleted`);
        }
      }
    }

    console.log(`[DELETE GUEST] Operation completed successfully`);
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
