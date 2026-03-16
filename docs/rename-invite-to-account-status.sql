-- Migration: Rename invite_status → account_status
-- Values: PENDING → INVITED, ACCEPTED → CLAIMED, DECLINED removed
-- Run this in the Supabase SQL Editor

-- 1) Create the new enum type
CREATE TYPE account_status AS ENUM ('INVITED', 'CLAIMED');

-- 2) Add a new column with the new type
ALTER TABLE memberships
  ADD COLUMN account_status account_status NOT NULL DEFAULT 'INVITED';

-- 3) Migrate existing data
--    A user is CLAIMED only if they have a real auth account (exists in auth.users).
--    Stub users (added by admin but never logged in) stay INVITED.
UPDATE memberships m
  SET account_status = 'CLAIMED'
  WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = m.user_id);

UPDATE memberships m
  SET account_status = 'INVITED'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = m.user_id);

-- 4) Drop the old column
ALTER TABLE memberships DROP COLUMN invite_status;

-- 5) (Optional) Drop the old enum type if nothing else references it
DROP TYPE IF EXISTS invite_status;

-- 6) Update seed.sql references if re-seeding:
--    invite_status → account_status
--    'ACCEPTED'    → 'CLAIMED'
--    'PENDING'     → 'INVITED'
