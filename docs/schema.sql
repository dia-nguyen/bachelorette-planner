-- Bachelorette Planner — Supabase / PostgreSQL Schema
-- Safe to re-run: uses IF NOT EXISTS and DO $$ guards throughout.
-- Tables map 1:1 to the TypeScript interfaces in src/lib/data/types.ts.

-- ============================================================
-- ENUM TYPES  (wrapped in DO blocks so re-runs don't error)
-- ============================================================
-- NOTE: deliberately NOT named "role" — that name conflicts with PostgreSQL's
-- internal pg_catalog role system and causes 54001 stack-depth recursion in PostgREST.
DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('MOH_ADMIN', 'BRIDESMAID', 'GUEST_CONFIRMED', 'GUEST_PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('DRAFT', 'PLANNED', 'CONFIRMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE budget_category AS ENUM (
    'ACCOMMODATION', 'TRANSPORT', 'FOOD_DRINK',
    'ACTIVITIES', 'DECORATION', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE budget_item_status AS ENUM ('PLANNED', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROFILES  (extends Supabase auth.users — auto-created on first Google OAuth login)
-- Populated by src/app/auth/callback/route.ts via the admin client.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  avatar_color  TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  location           TEXT NOT NULL DEFAULT '',
  start_at           TIMESTAMPTZ NOT NULL,
  end_at             TIMESTAMPTZ NOT NULL,
  description        TEXT,
  guest_field_schema JSONB NOT NULL DEFAULT '[]',
  join_code          TEXT UNIQUE,     -- 8-char uppercase code guests use to self-join
  created_by         UUID NOT NULL REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- MIGRATION (existing DB): ALTER TABLE trips ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- ============================================================
-- MEMBERSHIPS  (join table: profile ↔ trip + role + invite status)
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          member_role NOT NULL DEFAULT 'GUEST_PENDING',
  invite_status invite_status NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, profile_id)
);

-- ============================================================
-- EVENTS  (itinerary items within a trip)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  location         TEXT,
  status           event_status NOT NULL DEFAULT 'DRAFT',
  provider         TEXT,
  confirmation_code TEXT,
  attendee_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                task_status NOT NULL DEFAULT 'TODO',
  priority              task_priority NOT NULL DEFAULT 'MEDIUM',
  due_at                TIMESTAMPTZ,
  assignee_user_ids     UUID[] NOT NULL DEFAULT '{}',
  subtasks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  related_budget_item_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BUDGET ITEMS  (expenses tracked against a trip)
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  category              budget_category NOT NULL DEFAULT 'OTHER',
  planned_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'USD',
  status                budget_item_status NOT NULL DEFAULT 'PLANNED',
  responsible_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paid_by_user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  related_event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  related_task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  notes                 TEXT,
  cost_mode             TEXT,
  split_type            TEXT,
  planned_splits        JSONB,
  actual_splits         JSONB,
  split_attendee_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CHECKLIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  is_checked       BOOLEAN NOT NULL DEFAULT false,
  assignee_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE IF NOT EXISTS polls (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  question            TEXT NOT NULL,
  created_by_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  options             JSONB NOT NULL DEFAULT '[]',
  is_closed           BOOLEAN NOT NULL DEFAULT false,
  is_published        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  caption             TEXT,
  uploaded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  related_event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MOODBOARD
-- ============================================================
CREATE TABLE IF NOT EXISTS moodboard_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title              TEXT NOT NULL DEFAULT '',
  text               TEXT NOT NULL DEFAULT '',
  color              TEXT NOT NULL DEFAULT 'yellow',
  x                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  y                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  width              DOUBLE PRECISION NOT NULL DEFAULT 260,
  height             DOUBLE PRECISION NOT NULL DEFAULT 200,
  z_index            INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moodboard_notes_trip_id_idx
  ON moodboard_notes (trip_id);

CREATE TABLE IF NOT EXISTS moodboard_note_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      UUID NOT NULL REFERENCES moodboard_notes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  width        DOUBLE PRECISION,
  x            DOUBLE PRECISION NOT NULL DEFAULT 0,
  y            DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS moodboard_note_images
  ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS moodboard_note_images
  ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS moodboard_note_images_note_id_idx
  ON moodboard_note_images (note_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('moodboard-images', 'moodboard-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INVITES  (copy-paste invite links for joining a trip as a guest)
-- Admin generates a token-based link; guest redeems it after Google sign-in.
-- ============================================================
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,           -- normalized to lowercase
  token       TEXT NOT NULL UNIQUE,    -- crypto-random base64url (32 bytes)
  created_by  UUID NOT NULL REFERENCES profiles(id),
  claimed_at  TIMESTAMPTZ,             -- NULL = not yet redeemed
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, email)              -- one active invite per email per trip
);

-- ============================================================
-- ROW-LEVEL SECURITY (stubs — enable when auth is wired)
-- ============================================================
-- ============================================================
-- MIGRATION: if you already ran the old schema, execute this once in the
-- Supabase SQL editor to rename the conflicting enum:
--   ALTER TYPE role RENAME TO member_role;
-- ============================================================

-- ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trips         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE memberships   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE budget_items  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE polls         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE photos        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE invites       ENABLE ROW LEVEL SECURITY;

-- Members can only see data for trips they belong to:
-- CREATE POLICY "members_only" ON events
--   USING (trip_id IN (SELECT trip_id FROM memberships WHERE profile_id = auth.uid()));

-- Trip admins can create and view invites for their trips:
-- CREATE POLICY "admin_manage_invites" ON invites
--   USING (trip_id IN (
--     SELECT trip_id FROM memberships
--     WHERE profile_id = auth.uid() AND role = 'MOH_ADMIN'
--   ));
