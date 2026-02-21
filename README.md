# Bachelorette Planner MVP

A production-quality MVP for planning bachelorette weekends — budget tracking, guest management, events, tasks, and a real-time dashboard.

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Mode

The app ships with a **demo repository** backed by localStorage. No database setup is needed for the MVP. All data persists across browser refreshes.

- **Demo User:** Sarah Kim (MOH_ADMIN)
- **Demo Trip:** Sophie's Bachelorette Weekend — Miami Beach, FL

## Features

- **Dashboard** — KPIs (days to go, budget, RSVP, tasks), next up events, budget donut chart, open tasks, payments tracker
- **Guests** — Invite, accept/decline, role badges
- **Budget** — Add expenses, categorize, track planned vs actual, assign payer/responsible
- **Events** — Create, status management (Draft → Planned → Confirmed), timeline
- **Tasks** — Kanban-style columns (TODO / IN_PROGRESS / DONE), priority, assignee
- **Context Panel** — Click any event/task/budget item to see details in a slide-in right panel

## Architecture

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/trips/[tripId]/ # REST endpoints (dashboard, events, budget, guests)
│   └── page.tsx            # Main entry — Client Component with AppProvider
├── components/
│   ├── layout/             # Sidebar, HeaderBar, ContextPanel
│   ├── ui/                 # Card, Badge, Avatar, EmptyState
│   ├── dashboard/          # KPICards, NextUp, BudgetSnapshot, OpenTasks, PaymentsTracker
│   ├── views/              # DashboardView, GuestsView, BudgetView, EventsView, TasksView
│   ├── panels/             # EventDetail, TaskDetail, BudgetDetail
│   └── AppShell.tsx        # Main shell combining all pieces
├── lib/
│   ├── data/               # Types, Repository interface, DemoRepository, seed data
│   ├── domain/             # Pure dashboard aggregation functions
│   └── context/            # React context (AppProvider + useApp hook)
└── styles/
    └── tokens.css          # CSS custom properties (design tokens)
```

### Key Decisions

| Decision                        | Rationale                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Demo repo + localStorage        | Ship fast, no infra needed. Repository interface allows swapping in Supabase/Prisma later.                   |
| CSS custom properties as tokens | Single source of truth for theming per AGENT.md rules. Works with both Tailwind utilities and inline styles. |
| Pure domain functions           | Dashboard computations are deterministic and unit-testable — no React imports.                               |
| React Context for state         | Simple, avoids external state library. `subscribe()` pattern keeps UI reactive after mutations.              |
| Recharts for donut chart        | Lightweight, composable, React-native chart library.                                                         |

## Env Variables

None required for demo mode.

For future Supabase integration:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Role-Based Access

- **MOH_ADMIN** — Full dashboard analytics, guest management, all CRUD
- **GUEST_CONFIRMED** — Personal tasks, shared budget view, event list

Currently the demo defaults to admin view (Sarah Kim). Role switching is ready in the context layer.

## API Endpoints

| Method   | Endpoint                       | Description                           |
| -------- | ------------------------------ | ------------------------------------- |
| GET      | `/api/trips/:tripId/dashboard` | Server-computed dashboard aggregation |
| GET/POST | `/api/trips/:tripId/events`    | List / create events                  |
| GET/POST | `/api/trips/:tripId/budget`    | List / create budget items            |
| GET/POST | `/api/trips/:tripId/guests`    | List / invite guests                  |
