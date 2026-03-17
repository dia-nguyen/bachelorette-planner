-- Cleanup and Verification Script
-- This will check what trips exist and optionally clean up old demo data

-- Step 1: See all trips and who owns them
SELECT 
  t.id,
  t.name,
  t.location,
  t.created_by,
  u.name as owner_name,
  u.email as owner_email,
  (SELECT COUNT(*) FROM memberships m WHERE m.trip_id = t.id) as member_count
FROM trips t
LEFT JOIN users u ON t.created_by = u.id
ORDER BY t.created_at DESC;

-- Step 2: See all your memberships
SELECT 
  t.id as trip_id,
  t.name as trip_name,
  m.role,
  m.invite_status
FROM memberships m
JOIN trips t ON m.trip_id = t.id
WHERE m.user_id = '4b89332e-eae0-468a-ac65-f31f131182d6'
ORDER BY t.created_at DESC;

-- Step 3: If you see OLD trips you want to delete, uncomment and run this:
-- DELETE FROM trips WHERE name = 'Miami Beach Bachelorette';
-- This will cascade delete all events, tasks, budgets, memberships for that trip

-- Step 4: Verify your real trip exists
SELECT 
  t.name,
  t.location,
  (SELECT COUNT(*) FROM events WHERE trip_id = t.id) as events,
  (SELECT COUNT(*) FROM tasks WHERE trip_id = t.id) as tasks,
  (SELECT COUNT(*) FROM budget_items WHERE trip_id = t.id) as budget_items,
  (SELECT COUNT(*) FROM memberships WHERE trip_id = t.id) as members
FROM trips t
WHERE t.id = 'da9c4e82-1111-4444-8888-111111111111';
