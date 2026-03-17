-- Test the trigger to see if it handles edge cases properly
-- Run this to verify the trigger is working

-- Test 1: Check if trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Test 2: Check the trigger function definition
SELECT
  proname as function_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Test 3: Manually test the name extraction logic
SELECT
  COALESCE(
    NULL::text,  -- simulating no 'name' in metadata
    NULL::text,  -- simulating no 'full_name' in metadata
    split_part('test.user@example.com', '@', 1),
    'Guest'
  ) as extracted_name;
-- Should return: test.user

-- Test 4: Check for any recent errors in auth.users creation
-- (This will show if there were issues with the trigger)
SELECT
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Test 5: Check corresponding public.users records
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at,
  au.email as auth_email
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
ORDER BY u.created_at DESC
LIMIT 5;
