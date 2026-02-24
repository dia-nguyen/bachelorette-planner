# Bachelorette Planner

A full-featured bachelorette trip planner — budget tracking, guest management, events, tasks, timeline, and a real-time dashboard. Ships with a zero-config demo mode and an optional Supabase backend for multi-user auth.

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it — demo mode runs out of the box with localStorage, no database needed.

## Deploy to Vercel

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `app`
4. Add environment variable: `NEXT_PUBLIC_DATA_MODE` = `demo`
5. Deploy

## Data Modes

The app supports two data modes, controlled by the `NEXT_PUBLIC_DATA_MODE` env var:

### Demo (default)

No setup required. Uses an in-memory repository backed by localStorage.

- **Demo User:** Sarah Kim (MOH_ADMIN)
- **Demo Trip:** Sophie's Bachelorette Weekend — Miami Beach, FL

### Supabase (multi-user)

Invite-only auth with magic link emails. Requires a Supabase project.

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Setup:**
1. Create a Supabase project
2. Run the migrations in `supabase/migrations/` (001 schema, 002 RLS policies)
3. Configure a custom SMTP provider in Supabase Auth settings (the free tier limits built-in emails to 1/day — use Resend or Brevo for free SMTP)
4. Set the env vars above

## Features

- **Dashboard** — KPIs (days to go, budget, RSVP, tasks), next-up events, budget donut chart, open tasks, payments tracker
- **Guests** — Add guests (with or without sending an invite), accept/decline, role badges
- **Budget** — Add expenses, categorize, track planned vs actual, per-person cost splits
- **Events** — Create events, status management (Draft → Planned → Confirmed → Canceled)
- **Timeline** — Day-by-day chronological itinerary view
- **Tasks** — Kanban-style columns (TODO / IN_PROGRESS / DONE), priority, assignee
- **Context Panel** — Click any event/task/budget item to see details in a slide-in panel
- **Settings** — Trip details, guest field configuration, theme

## Architecture

```
src/
├── app/                        # Next.js App Router
│   ├── api/trips/[tripId]/     # REST endpoints (dashboard, events, budget, guests)
│   ├── api/invite/             # Guest invite / add endpoint
│   ├── auth/callback/          # Supabase auth callback handler
│   ├── login/                  # Magic link login page
│   └── page.tsx                # Main entry
├── components/
│   ├── layout/                 # Sidebar, HeaderBar, ContextPanel
│   ├── ui/                     # Card, Badge, Avatar, EmptyState
│   ├── dashboard/              # KPICards, NextUp, BudgetSnapshot, OpenTasks, PaymentsTracker
│   ├── views/                  # DashboardView, GuestsView, BudgetView, EventsView, TasksView, TimelineView, SettingsView
│   ├── panels/                 # EventDetail, TaskDetail, BudgetDetail
│   └── AppShell.tsx            # Main shell combining all pieces
├── lib/
│   ├── data/                   # Types, Repository interface, DemoRepository, seed data
│   ├── domain/                 # Pure dashboard aggregation functions
│   ├── context/                # AppProvider (state) + AuthProvider (session)
│   └── supabase/               # Browser, server, admin clients + middleware
└── styles/
    └── tokens.css              # CSS custom properties (design tokens)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Chakra UI + Tailwind CSS + CSS custom properties |
| Auth | Supabase Auth (magic links, invite-only) |
| Database | Supabase Postgres (with RLS) or localStorage (demo) |
| Forms | react-hook-form + Zod |
| Charts | Recharts |

## Role-Based Access

- **MOH_ADMIN** — Full dashboard analytics, guest management, all CRUD, invite permissions
- **GUEST_CONFIRMED** — Personal tasks, shared budget view, event list

Demo mode defaults to admin. In Supabase mode, roles are determined by the `memberships` table.

## API Endpoints

| Method   | Endpoint                       | Description                           |
| -------- | ------------------------------ | ------------------------------------- |
| GET      | `/api/trips/:tripId/dashboard` | Server-computed dashboard aggregation |
| GET/POST | `/api/trips/:tripId/events`    | List / create events                  |
| GET/POST | `/api/trips/:tripId/budget`    | List / create budget items            |
| GET/POST | `/api/trips/:tripId/guests`    | List / invite guests                  |
| POST     | `/api/invite`                  | Add or invite a guest (admin only)    |
