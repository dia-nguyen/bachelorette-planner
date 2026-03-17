-- Moodboard — Supabase tables & storage bucket
-- Safe to re-run: uses IF NOT EXISTS throughout.

-- ============================================================
-- MOODBOARD NOTES
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

-- ============================================================
-- MOODBOARD NOTE IMAGES  (references Supabase Storage URLs)
-- ============================================================
CREATE TABLE IF NOT EXISTS moodboard_note_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      UUID NOT NULL REFERENCES moodboard_notes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,       -- e.g. "moodboard-images/<tripId>/<uuid>.jpg"
  url          TEXT NOT NULL,       -- public URL from Supabase Storage
  width        DOUBLE PRECISION,    -- display width in px (NULL = auto)
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

-- ============================================================
-- SUPABASE STORAGE BUCKET  (run once in SQL editor or dashboard)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('moodboard-images', 'moodboard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Uploads happen through a server-side route using the service role,
-- so no client-side INSERT/DELETE storage policies are required here.
