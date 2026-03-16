-- Step 1: Find your user UUID
-- Run this first and copy the UUID that shows up
SELECT id, email FROM auth.users WHERE email = 'hey.diane.nguyen@gmail.com';

-- Step 2: Update the trip and membership to link to your account
-- Replace YOUR_ACTUAL_UUID_HERE with the UUID from Step 1
DO $$
DECLARE
  your_uuid UUID := 'YOUR_ACTUAL_UUID_HERE'; -- Replace with UUID from Step 1
  trip_uuid UUID := 'da9c4e82-1111-4444-8888-111111111111';
BEGIN
  
  -- Update trip to be created by you
  UPDATE trips 
  SET created_by = your_uuid 
  WHERE id = trip_uuid;
  
  -- Update or insert your membership
  INSERT INTO memberships (trip_id, user_id, role, invite_status)
  VALUES (trip_uuid, your_uuid, 'MOH_ADMIN', 'ACCEPTED')
  ON CONFLICT (trip_id, user_id) 
  DO UPDATE SET role = 'MOH_ADMIN', invite_status = 'ACCEPTED';
  
  -- Also ensure you exist in the users table
  INSERT INTO users (id, name, email)
  VALUES (your_uuid, 'Diane Nguyen', 'hey.diane.nguyen@gmail.com')
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Fixed! Trip and membership now linked to your account.';
  
END $$;
