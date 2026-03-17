# Bachelorette Planner — Full Build Prompt

Build a **Bachelorette Party Planning App** as a Next.js 16 web application with Supabase backend. The app lets a Maid of Honor (MOH) create a trip, invite guests via a shareable join code, and collaboratively manage the itinerary, budget, tasks, and guest list.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `src/` directory) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 + CSS custom properties (design tokens) |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase (PostgreSQL via PostgREST) |
| Charts | Recharts |
| Icons | react-icons (Hi outline set) |
| IDs | uuid v13 |
| Font | Inter (Google Fonts) |

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.57.4",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-icons": "^5.5.0",
    "recharts": "^3.7.0",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/uuid": "^10.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### Environment Variables

```env
NEXT_PUBLIC_DATA_MODE=supabase          # "supabase" or "demo"
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Design System

Use a CSS custom properties based token system. All colors, spacing, typography, and layout values are defined as CSS variables in a single `src/styles/tokens.css` file. Components reference tokens, never hardcoded values.

### Design Tokens

```css
:root {
  /* Colors */
  --color-bg-app: #e9d5f0;        /* soft purple page background */
  --color-bg-surface: #ffffff;     /* card/panel background */
  --color-bg-muted: #f5f6f8;      /* input/subtle backgrounds */
  --color-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-accent: #a78bfa;        /* purple, used for buttons/links/active states */
  --color-accent-soft: #e9d5ff;   /* light purple tint */
  --color-status-positive: #bbf7d0;
  --color-status-warning: #fde68a;
  --color-status-negative: #fca5a5;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;

  /* Shadow */
  --shadow-1: 0 2px 8px rgba(0, 0, 0, 0.05);
  --shadow-2: 0 8px 24px rgba(0, 0, 0, 0.08);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Typography */
  --font-family: "Inter", system-ui, sans-serif;
  --font-sm: 12px;
  --font-md: 14px;
  --font-lg: 18px;
  --font-xl: 24px;

  /* Layout */
  --sidebar-width: 72px;
  --context-panel-width: 520px;
}
```

### Global Styles (globals.css)

- Import Tailwind CSS 4 (`@import "tailwindcss"`)
- Import tokens.css
- Map tokens into a `@theme inline` block for Tailwind utility integration
- Set `box-sizing: border-box` globally
- Body: bg-app, text-primary, Inter font, font-md
- Custom thin scrollbars (6px, border-colored)

---

## Database Schema

Run this SQL in the Supabase SQL editor. The schema uses custom PostgreSQL enums and `IF NOT EXISTS` / `DO $$ ... EXCEPTION` guards so it is safe to re-run.

**CRITICAL**: The membership role enum is named `member_role`, NOT `role`. PostgreSQL has an internal `pg_catalog.role` that causes stack-depth recursion in PostgREST if you name your enum `role`.

### Enums

```
member_role: MOH_ADMIN, BRIDESMAID, GUEST_CONFIRMED, GUEST_PENDING
invite_status: PENDING, ACCEPTED, DECLINED
event_status: DRAFT, PLANNED, CONFIRMED, CANCELLED
task_status: TODO, IN_PROGRESS, DONE
task_priority: LOW, MEDIUM, HIGH
budget_category: ACCOMMODATION, TRANSPORT, FOOD_DRINK, ACTIVITIES, DECORATION, OTHER
budget_item_status: PLANNED, PAID, CANCELLED
booking_status: PENDING, CONFIRMED, CANCELLED
```

### Tables

#### profiles
Extends Supabase `auth.users`. Auto-created on first Google OAuth login via the auth callback route.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | References auth.users(id) ON DELETE CASCADE |
| email | TEXT UNIQUE NOT NULL | |
| name | TEXT NOT NULL DEFAULT '' | |
| avatar_url | TEXT | Google profile picture |
| avatar_color | TEXT | Hex color for initials avatar |
| is_verified | BOOLEAN NOT NULL DEFAULT false | |
| custom_fields | JSONB NOT NULL DEFAULT '{}' | Per-guest custom data (phone, notes, etc.) |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

#### trips

| Column | Type | Notes |
|---|---|---|
| id | UUID PK DEFAULT gen_random_uuid() | |
| name | TEXT NOT NULL | |
| location | TEXT NOT NULL DEFAULT '' | |
| start_at | TIMESTAMPTZ NOT NULL | |
| end_at | TIMESTAMPTZ NOT NULL | |
| description | TEXT | |
| guest_field_schema | JSONB NOT NULL DEFAULT '[]' | Array of custom field definitions |
| join_code | TEXT UNIQUE | 8-char uppercase code for guest self-join |
| created_by | UUID NOT NULL REFERENCES profiles(id) | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

#### memberships
Join table: profile <> trip + role + invite status.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK DEFAULT gen_random_uuid() | |
| trip_id | UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE | |
| profile_id | UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE | |
| role | member_role NOT NULL DEFAULT 'GUEST_PENDING' | |
| invite_status | invite_status NOT NULL DEFAULT 'PENDING' | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| | UNIQUE (trip_id, profile_id) | |

#### events

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| start_at | TIMESTAMPTZ NOT NULL | |
| end_at | TIMESTAMPTZ | |
| location | TEXT | |
| status | event_status DEFAULT 'DRAFT' | |
| provider | TEXT | Booking provider name |
| confirmation_code | TEXT | Booking reference |
| attendee_user_ids | UUID[] DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | |

#### tasks

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| status | task_status DEFAULT 'TODO' | |
| priority | task_priority DEFAULT 'MEDIUM' | |
| due_at | TIMESTAMPTZ | |
| assignee_user_ids | UUID[] DEFAULT '{}' | |
| related_event_id | UUID FK events ON DELETE SET NULL | Cross-link |
| related_budget_item_id | UUID | Cross-link (no FK) |
| created_at | TIMESTAMPTZ | |

#### budget_items

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| title | TEXT NOT NULL | |
| category | budget_category DEFAULT 'OTHER' | |
| planned_amount | NUMERIC(10,2) DEFAULT 0 | |
| actual_amount | NUMERIC(10,2) DEFAULT 0 | |
| currency | TEXT DEFAULT 'USD' | |
| status | budget_item_status DEFAULT 'PLANNED' | |
| responsible_user_id | UUID FK profiles | |
| paid_by_user_id | UUID FK profiles | |
| related_event_id | UUID FK events | |
| related_task_id | UUID FK tasks | |
| notes | TEXT | |
| cost_mode | TEXT | 'total' or 'per-person' |
| split_type | TEXT | 'even' or 'custom' |
| planned_splits | JSONB | `{ userId: amount }` |
| actual_splits | JSONB | `{ userId: amount }` |
| split_attendee_user_ids | UUID[] DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | |

#### checklist_items

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| title | TEXT NOT NULL | |
| is_checked | BOOLEAN DEFAULT false | |
| assignee_user_id | UUID FK profiles | |
| category | TEXT | |
| created_at | TIMESTAMPTZ | |

#### polls

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| question | TEXT NOT NULL | |
| created_by_user_id | UUID FK profiles | |
| options | JSONB DEFAULT '[]' | Array of poll option objects |
| is_closed | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ | |

#### photos

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| url | TEXT NOT NULL | |
| caption | TEXT | |
| uploaded_by_user_id | UUID FK profiles | |
| related_event_id | UUID FK events | |
| created_at | TIMESTAMPTZ | |

#### invites
Email-based invite links (separate from the join code system).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK trips | |
| email | TEXT NOT NULL | Normalized lowercase |
| token | TEXT NOT NULL UNIQUE | crypto-random base64url (32 bytes) |
| created_by | UUID FK profiles | |
| claimed_at | TIMESTAMPTZ | NULL = not yet redeemed |
| expires_at | TIMESTAMPTZ DEFAULT now() + 30 days | |
| created_at | TIMESTAMPTZ | |
| | UNIQUE (trip_id, email) | |

---

## TypeScript Domain Types

Define all domain types in `src/lib/data/types.ts`. These are the client-side representations (camelCase) that API responses are mapped into.

```typescript
// Roles
type Role = "MOH_ADMIN" | "BRIDESMAID" | "GUEST_CONFIRMED" | "GUEST_PENDING";
type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type EventStatus = "DRAFT" | "PLANNED" | "CONFIRMED" | "CANCELLED";
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
type BudgetCategory = "ACCOMMODATION" | "TRANSPORT" | "FOOD_DRINK" | "ACTIVITIES" | "DECORATION" | "OTHER";
type BudgetItemStatus = "PLANNED" | "PAID" | "CANCELLED";
type CostSplitType = "EVEN" | "CUSTOM";

interface User {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
  customFields?: Record<string, string>;
}

interface Trip {
  id: string;
  name: string;
  startAt: string;  // ISO date
  endAt: string;
  location: string;
  description?: string;
  createdByUserId: string;
  joinCode?: string;
  guestFieldSchema?: GuestFieldDef[];
}

interface Membership {
  tripId: string;
  userId: string;
  role: Role;
  inviteStatus: InviteStatus;
}

interface TripEvent {
  id: string;
  tripId: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  status: EventStatus;
  provider?: string;
  confirmationCode?: string;
  attendeeUserIds: string[];
}

interface Task {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string;
  assigneeUserIds: string[];
  relatedEventId?: string;
  relatedBudgetItemId?: string;
}

interface BudgetItem {
  id: string;
  tripId: string;
  title: string;
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  status: BudgetItemStatus;
  responsibleUserId?: string;
  paidByUserId?: string;
  relatedEventId?: string;
  relatedTaskId?: string;
  notes?: string;
  costMode?: string;
  splitType?: string;
  plannedSplits?: Record<string, number>;
  actualSplits?: Record<string, number>;
  splitAttendeeUserIds: string[];
}

interface GuestFieldDef {
  id: string;
  label: string;
  type: "text" | "select" | "checkbox";
  options?: string[];  // for select type
}

// Dashboard aggregation types
interface DashboardKPIs {
  daysToGo: number;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  myContribution: number;
  outstandingPayments: number;
  tasksCompletionPercent: number;
  guestsInvited: number;
  guestsConfirmed: number;
}
```

---

## Architecture

### Dual-Mode Data Layer

The app supports two modes controlled by `NEXT_PUBLIC_DATA_MODE`:

1. **`demo`** — In-memory data store backed by localStorage. Hardcoded demo data with 1 trip, 6 users, sample events/tasks/budget. No auth required. Uses a `Repository` interface abstraction with `demoRepository` implementation.

2. **`supabase`** — Real PostgreSQL via Supabase. Google OAuth auth. All data loading goes through Next.js API routes (NOT direct client-side PostgREST queries).

### Critical Architecture Decision: Server-Side API Routes

**DO NOT make direct Supabase client calls from React components.** Supabase's free tier has ~10-20 connection pool slots. If the browser fires 15+ concurrent PostgREST queries, later queries timeout with error 57014.

Instead, use Next.js API routes as a server-side proxy:

| Client fetches | API route does |
|---|---|
| `GET /api/me` | 2 sequential queries (profile + admin check) |
| `GET /api/trips` | 2 parallel queries (memberships + created trips), then 1 follow-up |
| `GET /api/trips/[tripId]/all` | 2 batches of 4 parallel queries each, then 1 profiles query |
| `POST /api/trips` | Insert trip + membership (admin client) |
| `POST /api/trips/join` | Lookup by join_code + upsert membership |

The browser makes 2-3 HTTP calls total per page load instead of 15 direct PostgREST calls.

### Supabase Client Setup

Create four Supabase client modules in `src/lib/supabase/`:

1. **`client.ts`** (browser) — `createBrowserClient` from `@supabase/ssr`. Used ONLY for `auth.getSession()` and `auth.signInWithOAuth()`. Export `isSupabaseConfigured()` helper.

2. **`server.ts`** (API routes) — `createServerClient` from `@supabase/ssr` with cookie handling. Used in all GET/POST API routes for authenticated queries.

3. **`admin.ts`** — Raw `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`. Used for operations that bypass RLS (profile upserts, membership creation, invite management).

4. **`middleware.ts`** — Session refresh helper for Next.js middleware. Exports `updateSession(request)` returning `{ response, user }`.

---

## Auth Flow

### Google OAuth Sign-In

1. User clicks "Sign in with Google" on `/login`
2. `supabase.auth.signInWithOAuth({ provider: "google", redirectTo: "/auth/callback?next=/" })`
3. Google redirects back to `/auth/callback`
4. Callback route exchanges code for session, upserts profile (name, avatar from Google metadata), redirects to `next` param

### Middleware (`src/middleware.ts`)

- Public routes: `/login`, `/auth/callback`, `/invite`, `/onboarding`
- Unauthenticated users on any other route -> redirect to `/login?next={path}`
- Authenticated users on `/login` -> redirect to `/`

### AuthContext

React context providing: `session`, `user`, `role`, `isAdmin`, `isVerified`, `isDemo`, `loading`, `signOut()`.

- On mount: `supabase.auth.getSession()`, then `fetch("/api/me")` to hydrate role
- Listens to `onAuthStateChange` for session updates
- Demo mode: returns hardcoded admin state

---

## User Flows

### New User (No Trips)

1. Sign in with Google -> auth callback creates profile
2. App loads: AuthContext hydrates, AppContext Effect 1 fetches `/api/trips` -> empty array
3. AppShell detects `!auth.loading && !app.isLoadingTrips && availableTrips.length === 0` -> redirects to `/onboarding`
4. User chooses "Create a trip" or "Join with code"

**CRITICAL**: The onboarding redirect MUST wait for both `auth.loading === false` AND `app.isLoadingTrips === false`. Otherwise, the redirect fires during the auth hydration window (~100-200ms) when `user` is still null and trips haven't loaded yet.

### Create Trip

1. Fill form: name, location, start/end dates
2. `POST /api/trips` -> generates 8-char `join_code`, creates trip + MOH_ADMIN membership
3. Redirect to `/` -> dashboard loads

### Join Trip

1. Enter 8-character code from MOH's Settings page
2. `POST /api/trips/join` -> lookup trip by `join_code`, create GUEST_PENDING membership
3. Redirect to `/` -> dashboard loads

---

## API Routes

### `GET /api/me`
Returns `{ isVerified, isAdmin, role }`. Admin = user has created at least one trip.

### `GET /api/trips`
Returns `{ trips: [...] }` — all trips user created OR is a member of, sorted by start_at desc. Raw DB rows (snake_case).

### `POST /api/trips`
Body: `{ name, location, startAt, endAt, description? }`. Generates `join_code`. Uses admin client to insert trip + MOH_ADMIN membership. Returns `{ trip }`.

### `POST /api/trips/join`
Body: `{ code }`. Normalizes to uppercase. Looks up trip by `join_code`. Upserts profile + GUEST_PENDING membership. Returns `{ ok, tripId }`.

### `GET /api/trips/[tripId]/all`
Returns all entity data in one response. Server-side batched queries (4+4+1 pattern):
- Batch 1: trip, memberships, events, tasks
- Batch 2: budget_items, checklist_items, polls, photos
- Follow-up: profiles for all member IDs

Returns `{ trip, memberships, events, tasks, budgetItems, checklistItems, polls, photos, profiles }`.

---

## State Management (React Context)

### AppContext

The central state container. Provides:

**Read state:**
- `tripId`, `currentUserId`, `currentRole`
- `trip`, `events`, `tasks`, `budgetItems`, `memberships`, `users`
- `checklistItems`, `polls`, `photos`
- `dashboard` (memoized aggregation)
- `panel` (context panel state: `{ type: "event" | "task" | "budget" | null, id }`)
- `guestFieldSchema`
- `availableTrips`, `isLoadingTrips`, `isLoadingData`

**Mutations:**
- CRUD for events, tasks, budget items, checklist items, polls, photos
- Guest management: `inviteUser`, `updateUser`, `updateMembershipStatus`, `updateMemberRole`
- `planActivity(input)` — create linked event/task/budget in one action
- `createTrip(data)`, `switchTrip(tripId)`
- `openPanel()`, `closePanel()`
- Data management: `clearAllData`, `resetDemoData`, `exportData`, `importData`

**Effects (Supabase mode):**

- **Effect 1** (when user changes): `fetch("/api/trips")` -> map rows via `mapTripRow()` -> set `availableTrips` + `activeTripId`. Persist last trip ID in `localStorage("bp-last-trip-id")`.

- **Effect 2** (when activeTripId or tick changes): `fetch("/api/trips/${activeTripId}/all")` -> map ALL response data from snake_case DB rows to camelCase domain types -> set all entity state variables.

**Row Mapper:**
```typescript
function mapTripRow(row: any): Trip {
  return {
    id: row.id,
    name: row.name,
    startAt: String(row.start_at ?? ""),
    endAt: String(row.end_at ?? ""),
    location: row.location ?? "",
    description: row.description ?? "",
    createdByUserId: row.created_by,
    joinCode: row.join_code ?? undefined,
    guestFieldSchema: (row.guest_field_schema ?? []) as GuestFieldDef[],
  };
}
```

Similar mapping for memberships (trip_id -> tripId, profile_id -> userId), events (start_at -> startAt, end_at -> endAt, etc.), tasks, budget items (planned_amount -> Number()), checklist items, polls, photos.

**Synthetic MOH membership:** If `trip.created_by` is not in the memberships list, unshift a synthetic membership with role MOH_ADMIN and inviteStatus ACCEPTED.

**Fallback user entries:** For any membership where the profile wasn't found, create a placeholder User with name "Guest" (or current user's name from `user.user_metadata`).

---

## UI Components

### Layout

#### AppShell
Full-screen flex layout: `Sidebar | MainContent | ContextPanel`

- Sidebar: 72px wide, icon-only navigation
- Main: flex-1, scrollable content area
- ContextPanel: 520px slide-in from right

Tab routing via state (not URL): dashboard, events, guests, budget, tasks, settings.

Loading state: centered "Loading..." when `isLoadingTrips || isLoadingData`.
Onboarding redirect: when auth settled + no trips + supabase mode -> `/onboarding`.

#### Sidebar
- Trip avatar at top (first letter of trip name, accent background)
- Click avatar -> dropdown showing all trips + "New Trip" option
- Nav icons: Dashboard (grid), Events (calendar), Guests (users), Budget (dollar), Tasks (checkbox)
- Settings icon at bottom
- Active tab: accent background pill

#### HeaderBar
- Page title (left)
- "+" add button (right, accent color, opens Plan Activity form)
- Three-dot menu: Export JSON, Import JSON, Clear All, Restore Demo Data

#### ContextPanel
- Overlay slide-in from right, 520px wide
- Backdrop click or Escape to close
- Header with title + optional badge + close button

### UI Primitives

#### Card
Reusable container: white bg, border, shadow-1, radius-md, padding. Optional `hoverable` prop adds cursor-pointer + shadow-2 on hover.

#### Badge
Semantic status pill. Variants: neutral (gray), positive (green), warning (yellow), negative (red), accent (purple). Helper functions: `eventStatusVariant()`, `taskStatusVariant()`, `budgetStatusVariant()`, `inviteStatusVariant()`.

#### Avatar / AvatarGroup
Circular initials avatar with background color. AvatarGroup shows up to N avatars with +{remaining} overflow indicator.

#### EmptyState
Centered message with optional action button for empty lists.

### Dashboard View

Grid layout with 5 widget sections:

1. **KPI Cards** (4 across): Days Until Trip (countdown or "Today!"), Tasks Summary (donut SVG chart: done/in-progress/todo), Budget Status (spent/total with progress bar), Guest Count (invited/confirmed).

2. **Next Up** (left half): Next 5 upcoming non-cancelled events, sorted by start_at. Shows day/date/time, title, status badge. Click opens event detail panel.

3. **Budget Snapshot** (right half): Recharts PieChart donut showing spending by category. Color-coded legend. Center label with total. Per-category planned vs actual breakdown below.

4. **Open Tasks** (left half): Top 6 open tasks sorted by priority. Shows title, priority badge, due date (with overdue indicator), assignee avatars, unassigned warning. Summary counts: urgent/in-progress/done.

5. **Payments Tracker** (right half): Per-person table: name, planned total, actual total, paid amount. Net balance highlighted green (positive) or red (negative).

### Events View

Grid of event cards sorted by start_at. Each card shows: title, status badge, location, date/time, attendee count, description excerpt. Click opens EventDetail panel. Empty state when no events.

### Budget View

- Dropdown filter: "All Participants" or specific person
- When filtered to a person: shows their planned/actual/paid/net summary
- Budget item cards: title, category badge, planned vs actual amounts, status, responsible person
- Click opens BudgetDetail panel

### Tasks View

Three view modes via toggle: Kanban | List | My Tasks.

- **Kanban**: Three columns (TODO, IN_PROGRESS, DONE). Cards are draggable between columns using native Drag API (no external library). Drop updates task status.
- **List**: Flat list of all tasks.
- **My Tasks**: Filtered to current user's assigned tasks.

Task cards show: title, priority badge, due date, assignee avatars, linked event/budget indicators.

### Guests View

- "Invite Guest" button (name + email form)
- Guest table columns: Avatar+Name, Email, Role (dropdown), Invite Status (dropdown), Custom Fields (editable)
- Schema Manager section: add/remove/reorder custom guest fields (text, select, checkbox)
- Drag-to-reorder fields

### Settings View

- Countdown banner (days until trip, or "Today's the day!", or "X days ago")
- Form: Trip Name, Description, Location, Start Date, End Date
- Save button with success feedback
- **Join Code display** (Supabase mode only): large monospace code with Copy button. Instructional text: "Share this code with guests."

### Detail Panels

#### EventDetail
Read mode: title, status badge, date/time, duration, location, provider/confirmation code, attendees (avatar group), linked tasks/budget.
Edit mode: form fields for all properties. Attendee toggle checkboxes. Save/cancel.

#### BudgetDetail
Read mode: category, amounts (planned/actual), status, responsible/paid by, per-person breakdown table, linked event/task.
Edit mode: title, category, status, cost mode (total vs per-person), split type (even vs custom), custom split table with per-person amount inputs, attendee picker, link event/task dropdowns.

#### TaskDetail
Read mode: title, status, priority, description, due date, assignees, linked event/budget.
Edit mode: form fields, assignee multi-select, link event/budget dropdowns.

### Plan Activity Form (Modal)

Unified creation form. User describes the activity, toggles which entities to create (Event, Task, Budget). Everything gets auto-linked.

- Toggle pills at top: Event / Task / Budget (any combination)
- Shared title field
- Per-section: fields relevant to that entity type
- Attendee/assignee pickers with user avatars
- On submit: creates all selected entities with cross-references populated

---

## Domain Logic (`src/lib/domain/dashboard.ts`)

Pure functions for dashboard aggregations. No side effects, fully deterministic.

### Key Functions

```typescript
daysToGo(tripStartAt: string, now?: Date): number
formatCurrency(amount: number): string  // "$1,234" format
computeKPIs(trip, memberships, users, events, tasks, budgetItems, currentUserId): DashboardKPIs
computeNextUp(events, now?): TripEvent[]  // next 5 non-cancelled, sorted by start
computeBudgetBreakdown(budgetItems): CategoryBreakdown[]
computeTasksSummary(tasks): { urgent, inProgress, done, total }
computePaymentsSummary(budgetItems, users, memberships): PaymentSummary[]
computeMyTasks(tasks, currentUserId): Task[]
computeDashboard(trip, memberships, users, events, tasks, budgetItems, currentUserId): DashboardData
```

### Budget Split Logic

- **Even split**: `plannedAmount / attendeeCount` per person
- **Custom split**: explicit `plannedSplits[userId]` amounts
- Attendees come from: linked event's `attendeeUserIds`, OR budget item's `splitAttendeeUserIds`
- `computePaymentsSummary` aggregates across all budget items to show per-person planned/actual/paid totals

---

## Demo Mode

When `NEXT_PUBLIC_DATA_MODE=demo`:

- Auth bypassed: hardcoded `{ role: "MOH_ADMIN", isAdmin: true, isVerified: true, isDemo: true }`
- Data from in-memory store seeded with demo data (demoData.ts)
- Repository interface (`Repository`) with `demoRepository` implementation
- Data persisted to localStorage, auto-syncs via subscribe/notify pattern
- Mutations go through repository methods, trigger re-renders via tick counter

### Demo Data

- 1 trip: "Sophie's Bachelorette Weekend", Miami Beach, dates in March 2026
- 6 users with avatar colors: Sarah Kim (MOH), Madison, Jessie, Senah, Taylor, Ava
- 4 events: Dinner, Club, Brunch, Pool party (various statuses)
- 6 tasks: Book table, Reserve photographer, Buy decorations, Confirm VIP, etc.
- 4 budget items across categories with various split configurations
- Memberships: mix of ACCEPTED and PENDING

---

## File Structure

```
src/
  middleware.ts              # Auth routing guard
  app/
    globals.css              # Tailwind + token imports
    layout.tsx               # HTML root, AuthProvider wrapper
    page.tsx                 # Home: AppProvider > AppShell
    auth/callback/route.ts   # Google OAuth redirect handler
    login/page.tsx           # Google sign-in page
    onboarding/page.tsx      # Create trip or join with code
    api/
      me/route.ts            # GET: profile + admin status
      invite/route.ts        # GET: invite metadata, POST: claim invite
      trips/
        route.ts             # GET: user's trips, POST: create trip
        join/route.ts        # POST: join trip with code
        [tripId]/
          all/route.ts       # GET: all entity data for trip
          dashboard/route.ts # GET: dashboard data (demo)
          events/route.ts    # GET/POST events (demo)
          budget/route.ts    # GET/POST budget items (demo)
          guests/route.ts    # GET/POST guests (demo)
  components/
    AppShell.tsx             # Main layout: sidebar + header + content + panel
    layout/
      Sidebar.tsx            # Left nav with trip switcher
      HeaderBar.tsx          # Top bar with title + actions
      ContextPanel.tsx       # Right slide-in detail panel
    ui/
      Card.tsx               # Reusable card
      Badge.tsx              # Status badge with variants
      Avatar.tsx             # Initials avatar + AvatarGroup
      EmptyState.tsx         # Empty list placeholder
    dashboard/
      KPICards.tsx           # 4 KPI metric cards
      BudgetSnapshot.tsx     # Donut chart budget breakdown
      NextUp.tsx             # Upcoming events list
      OpenTasks.tsx          # Priority task list
      PaymentsTracker.tsx    # Per-person payment table
    views/
      DashboardView.tsx      # Dashboard layout orchestrator
      EventsView.tsx         # Events grid
      BudgetView.tsx         # Budget list with per-person filter
      TasksView.tsx          # Kanban/list/mine task views
      GuestsView.tsx         # Guest table + custom fields
      SettingsView.tsx       # Trip settings + join code
      PlanActivityForm.tsx   # Unified create form (modal)
    panels/
      EventDetail.tsx        # Event view/edit panel
      BudgetDetail.tsx       # Budget item view/edit panel
      TaskDetail.tsx         # Task view/edit panel
  lib/
    context/
      AuthContext.tsx         # Auth state provider
      AppContext.tsx          # App state + mutations provider
    data/
      types.ts               # All TypeScript domain types
      repository.ts          # Repository interface
      demoData.ts            # Hardcoded demo seed data
      demoRepository.ts      # In-memory repository implementation
      supabaseRepository.ts  # Placeholder (routes to demo)
    domain/
      dashboard.ts           # Pure dashboard aggregation functions
    supabase/
      client.ts              # Browser Supabase client
      server.ts              # Server Supabase client (API routes)
      admin.ts               # Service-role Supabase client
      middleware.ts           # Session refresh helper
  styles/
    tokens.css               # CSS custom properties
```

---

## Implementation Order

Build in this sequence to get a working app incrementally:

### Phase 1: Foundation
1. `create-next-app` with TypeScript, Tailwind, `src/` directory
2. Design tokens (`tokens.css`) + globals.css
3. Domain types (`types.ts`)
4. Demo data + demo repository + repository interface
5. Domain logic (`dashboard.ts`)

### Phase 2: Layout & UI Primitives
6. UI primitives: Card, Badge, Avatar, EmptyState
7. Layout: Sidebar, HeaderBar, ContextPanel
8. AppShell (tab routing, loading state, modals)

### Phase 3: Views (Demo Mode First)
9. AppContext (demo mode: reads from repository, mutation handlers)
10. DashboardView + all 5 dashboard widgets
11. EventsView + EventDetail panel
12. TasksView (kanban + list + mine) + TaskDetail panel
13. BudgetView + BudgetDetail panel (with split logic)
14. GuestsView (table + custom fields + schema manager)
15. SettingsView
16. PlanActivityForm

### Phase 4: Supabase Auth
17. Supabase client modules (client.ts, server.ts, admin.ts, middleware.ts)
18. Middleware (auth guard)
19. Login page + auth callback route
20. AuthContext (session hydration, role inference via `/api/me`)

### Phase 5: Supabase Data
21. `GET /api/me` route
22. `GET /api/trips` + `POST /api/trips` routes (with join_code generation)
23. `GET /api/trips/[tripId]/all` route
24. `POST /api/trips/join` route
25. Update AppContext: Effect 1 uses `fetch("/api/trips")`, Effect 2 uses `fetch("/api/trips/${id}/all")`
26. Onboarding page (`/onboarding`)
27. AppShell redirect to onboarding (with auth.loading guard)
28. SettingsView: display join code with copy button

### Phase 6: Invite System
29. `GET/POST /api/invite` routes (token-based email invites)
30. Invite page for token redemption

---

## Known Gotchas

1. **Never name a PostgreSQL enum `role`** — it conflicts with `pg_catalog.role` and causes 54001 stack-depth recursion in PostgREST. Use `member_role`.

2. **Never make direct Supabase queries from React components** in production. Supabase free tier's ~10-20 connection pool slots will be exhausted by 15+ concurrent browser-to-PostgREST queries. Always go through server-side API routes.

3. **The onboarding redirect in AppShell MUST wait for `auth.loading === false`** before checking trip count. Otherwise it fires during the auth hydration window when `user` is null and trips are empty, sending logged-in users back to onboarding on every refresh.

4. **The `mapTripRow` function and all entity mappers convert snake_case DB columns to camelCase domain types.** The `/api/trips/[tripId]/all` route returns raw DB rows; all mapping happens client-side in AppContext Effect 2.

5. **Synthetic MOH membership**: If `trip.created_by` is not already in the memberships array, unshift a synthetic entry. This handles the case where the trip creator doesn't have an explicit membership row.

6. **Budget split calculations**: When cost_mode is "per-person", the displayed planned_amount is already per-person. When it's "total" with even split, divide by attendee count. Custom splits use explicit `planned_splits[userId]` values.

7. **`localStorage("bp-last-trip-id")`** persists the last active trip ID across page reloads. Effect 1 reads it to restore the user's last-viewed trip.
