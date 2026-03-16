# Guest Claim Flow

## Overview

Admins can add guests to trips without forcing them to create accounts immediately. When those users eventually log in with the same email, they automatically claim their guest record and gain access to the trip.

## Two Ways to Add Guests

### 1. Add Only (Default)

**What happens:**

- Admin enters guest name and email
- System creates a "stub" user record in `public.users` (no auth account)
- Guest is added to the trip as `GUEST_CONFIRMED` with status `ACCEPTED`
- **No email is sent**
- Guest data (tasks, events, budget splits) can be managed by admin

**When guest logs in:**

- User signs in via Google OAuth with the matching email
- System detects stub user record and merges it into their auth account
- All references (memberships, tasks, events, budgets) are migrated to their real auth user ID
- Stub record is deleted
- User now has full access to the trip

### 2. Add + Invite

**What happens:**

- Admin enters guest name and email
- System creates full auth user in Supabase Auth
- Database trigger automatically creates `public.users` record
- Guest is added to the trip as `GUEST_CONFIRMED` with status `PENDING`
- **Invite email is sent** with magic link to create account
- When they click the link and log in, status changes to `ACCEPTED`

## Technical Implementation

### Files Modified

**`src/app/api/invite/route.ts`**

- Checks if user exists (by email) in `public.users`
- If `action === "add"`: Creates stub user record only (no auth)
- If `action === "invite"`: Creates full auth user + sends invite email
- Both actions create membership record

**`src/app/auth/callback/route.ts`**

- After successful login, checks for stub user with same email
- If found, migrates all references:
  - `memberships.user_id`
  - `tasks.assignee_user_ids` (array field)
  - `events.attendee_user_ids` (array field)
  - `budget_items.responsible_user_id`
  - `budget_items.paid_by_user_id`
  - `budget_items.split_attendee_user_ids` (array field)
  - `checklist_items.assignee_user_id`
  - `polls.created_by_user_id`
- Deletes stub user record after migration
- Creates/updates user record with auth data

**`src/components/views/GuestsView.tsx`**

- Updated success messages to clarify behavior
- Help text explains claim flow for "Add Only"

**`docs/add-user-sync-trigger.sql`**

- Database trigger to auto-sync `auth.users` → `public.users`
- Handles the "Add + Invite" flow where auth user is created first

## User Experience

### From Admin Perspective

```
Admin clicks "Add Guest"
→ Enters: name="Sarah" email="sarah@example.com"
→ Clicks "Add Only"
→ "Guest added. They can claim this when they log in with this email."
```

Guest shows up in the list immediately, admin can assign them to tasks/events/budgets.

### From Guest Perspective

```
Sarah receives text message from admin: "You're invited! Log in at app.com"
→ Sarah visits app.com and clicks "Sign in with Google"
→ Logs in with sarah@example.com
→ Automatically gains access to trip
→ Sees all tasks/events they were assigned to
```

## Benefits

1. **No account requirement for planning** - Admin can build the full trip itinerary before guests create accounts
2. **Flexible onboarding** - Guests can join whenever they're ready
3. **No orphaned data** - Guest assignments persist and are claimed automatically
4. **Seamless migration** - All historical data is preserved when they claim their account

## Database Schema Notes

- `public.users.id` is NOT always the same as `auth.users.id`
- Stub users have a generated UUID that differs from their eventual auth UUID
- The merge process in `auth/callback` handles the ID transition
- Foreign keys all use `ON DELETE CASCADE` to prevent orphaned records during merge
