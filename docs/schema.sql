-- Bachelorette Planner — Supabase / PostgreSQL Schema
-- This is the target schema for when we migrate off the demo repository.
-- Tables map 1:1 to the TypeScript interfaces in src/lib/data/types.ts.

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  image_url   TEXT,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MEMBERSHIPS  (join table: user ↔ trip + role + invite status)
-- ============================================================
CREATE TYPE role AS ENUM ('MOH_ADMIN', 'BRIDESMAID', 'GUEST_CONFIRMED', 'GUEST_PENDING');
CREATE TYPE invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE');

CREATE TABLE memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          role NOT NULL DEFAULT 'GUEST_PENDING',
  invite_status invite_status NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

-- ============================================================
-- EVENTS  (itinerary items within a trip)
-- ============================================================
CREATE TYPE event_status AS ENUM ('DRAFT', 'PLANNED', 'CONFIRMED', 'CANCELLED');

CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  date         DATE NOT NULL,
  start_time   TEXT,            -- e.g. "14:00"
  end_time     TEXT,
  location     TEXT,
  status       event_status NOT NULL DEFAULT 'DRAFT',
  cost_per_person NUMERIC(10,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       task_status NOT NULL DEFAULT 'TODO',
  priority     task_priority NOT NULL DEFAULT 'MEDIUM',
  assigned_to  UUID REFERENCES users(id),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BOOKINGS  (linked to events — e.g. hotel, spa reservation)
-- ============================================================
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  confirmation_code TEXT,
  status            booking_status NOT NULL DEFAULT 'PENDING',
  amount            NUMERIC(10,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BUDGET ITEMS  (expenses tracked against a trip)
-- ============================================================
CREATE TYPE budget_category AS ENUM (
  'ACCOMMODATION', 'TRANSPORT', 'FOOD_DRINK',
  'ACTIVITIES', 'DECORATION', 'OTHER'
);
CREATE TYPE budget_item_status AS ENUM ('PLANNED', 'PAID', 'CANCELLED');

CREATE TABLE budget_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  category        budget_category NOT NULL DEFAULT 'OTHER',
  planned_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          budget_item_status NOT NULL DEFAULT 'PLANNED',
  responsible_id  UUID REFERENCES users(id),
  paid_by_id      UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW-LEVEL SECURITY (stubs — enable when auth is wired)
-- ============================================================
-- ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Example policy: users can only see data for trips they belong to
-- CREATE POLICY "members_only" ON events
--   USING (trip_id IN (SELECT trip_id FROM memberships WHERE user_id = auth.uid()));
