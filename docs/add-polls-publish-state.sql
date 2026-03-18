-- Add draft/publish support for polls.
-- Existing polls are backfilled to published=true to avoid hiding historical polls.

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

UPDATE polls
SET is_published = true
WHERE is_published = false;
