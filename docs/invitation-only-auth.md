# Invitation-Only Authentication Flow

## Overview

The app now uses an invitation-only authentication system without magic links. Users can only create accounts if they've been added to the guest list by an admin.

## How It Works

### 1. Admin Adds Guest

- Admin clicks "Add Guest" in the Guests view
- Enters guest's email and name
- System creates a **stub user** (database record without authentication account)
- Guest is added to the trip with "ACCEPTED" status

### 2. Guest Creates Account

- Guest visits the login page
- Clicks "Sign in with Google"
- Google OAuth authenticates them
- **Validation happens** in auth callback:
  - ✅ If email matches a stub user OR has existing memberships → proceed
  - ❌ If email not invited → delete auth account and redirect to login with error

### 3. Account Claim & Merge

- System detects stub user matching the email
- Merges stub user into auth account:
  - Transfers all memberships
  - Updates task assignments
  - Updates event attendees
  - Updates budget items
  - Updates all array field references
- Deletes the stub user record
- User auto-redirects to their trip

## Key Changes Made

### Removed Features

- ❌ "Add + Invite" button - magic links require paid Supabase tier
- ❌ Email invite functionality
- ❌ "PENDING" invite status for new guests

### Updated Components

#### [src/components/views/GuestsView.tsx](../src/components/views/GuestsView.tsx)

- Single "Add Guest" button (was "Add Only" / "Add + Invite")
- Updated helper text explaining invitation process
- All guests added with "ACCEPTED" status

#### [src/app/api/invite/route.ts](../src/app/api/invite/route.ts)

- Removed `action` parameter
- Always creates stub users
- No email sending logic
- Simpler, single-path flow

#### [src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts)

- **NEW**: Validates user is invited before allowing account creation
- Checks for stub user OR existing memberships
- Rejects uninvited users and deletes their auth account
- Redirects rejected users to login with error message

#### [src/app/login/page.tsx](../src/app/login/page.tsx)

- Updated text: "Sign in or create an account with Google"
- Shows error message for uninvited users
- Clarifies invitation-only access

## User Experience

### For Admins

1. Click "Add Guest"
2. Enter email and name
3. Share login URL with guest
4. Guest automatically gets access when they sign in

### For Guests

1. Receive login URL from organizer
2. Click "Sign in with Google"
3. Authenticate with Google account
4. **If invited**: Auto-redirect to trip dashboard
5. **If not invited**: See error message requesting invitation

## Security

- Only invited emails can create accounts
- Unauthorized auth accounts are immediately deleted
- All database operations use admin client with proper authorization
- Comprehensive logging for audit trail

## Testing Checklist

- [ ] Deploy database trigger: [fix-trigger-name-handling.sql](./fix-trigger-name-handling.sql) (REQUIRED - fixes duplicate email error)
- [ ] Admin can add guest with email
- [ ] Guest with invited email can create account (trigger skips insert, callback merges stub)
- [ ] Guest without invitation sees error and cannot access
- [ ] Stub user merges correctly (check memberships, tasks, events)
- [ ] Auto-redirect to trip works after first login
- [ ] Delete guest removes all access

## Database Trigger Details

The trigger handles two scenarios:

1. **Stub user exists** (invited guest):
   - Trigger detects email already in `public.users`
   - Skips insert to avoid duplicate key error
   - Auth callback merges stub user into new auth account

2. **No stub user** (not invited yet):
   - Trigger inserts new user record from auth metadata
   - Auth callback validates and rejects if no memberships found

## Error Messages

### Not Invited Error

> "You need an invitation to create an account. Please ask your event organizer to add your email to the guest list."

This appears when:

- User signs in with Google
- Their email has no stub user record
- They have no existing memberships
