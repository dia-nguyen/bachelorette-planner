-- Add support for multi-vote polls.

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS max_votes_per_user INTEGER NOT NULL DEFAULT 1;

UPDATE polls
SET max_votes_per_user = 1
WHERE max_votes_per_user IS NULL OR max_votes_per_user < 1;

ALTER TABLE polls
  DROP CONSTRAINT IF EXISTS polls_max_votes_per_user_check;

ALTER TABLE polls
  ADD CONSTRAINT polls_max_votes_per_user_check
  CHECK (max_votes_per_user >= 1);
