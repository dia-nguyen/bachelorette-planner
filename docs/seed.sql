-- Bachelorette Planner — Seed Data from JSON Export
-- Cheery's Bachelorette Trip to Las Vegas (May 14-17, 2026)
-- Replace YOUR_USER_UUID_HERE with your actual user UUID from Supabase Auth (hey.diane.nguyen@gmail.com)
-- You can find it by running: SELECT id, email FROM auth.users;

DO $$
DECLARE
  -- Your authenticated user (replace this!)
  owner_id UUID := 'YOUR_USER_UUID_HERE'; -- hey.diane.nguyen@gmail.com

  -- Trip
  trip_id UUID := 'da9c4e82-1111-4444-8888-111111111111';

  -- Users (guests)
  user_youlee UUID := 'da9c4e82-2222-4444-8888-222222222222';
  user_riona UUID := 'da9c4e82-3333-4444-8888-333333333333';
  user_navneet UUID := 'da9c4e82-4444-4444-8888-444444444444';
  user_jenny UUID := 'da9c4e82-5555-4444-8888-555555555555';
  user_cheery UUID := 'da9c4e82-6666-4444-8888-666666666666';
  user_szeki UUID := 'da9c4e82-7777-4444-8888-777777777777';

  -- Events
  event_hotel UUID := '7b337440-fa30-4de5-b7b0-79dd0d5e5ac1';
  event_dinner UUID := 'a6937054-5077-49b4-8b53-136029bde309';
  event_brunch UUID := '1bdbeb00-f472-43af-9236-18b26db73728';
  event_edc UUID := '7597279e-27a9-4c0a-91a3-ae7a21ac07e6';
  event_spa UUID := '5a1dec97-2e21-44a0-963a-c34ff1286b5a';

BEGIN

  -- Create guest users (not the owner - they authenticate via Google)
  INSERT INTO users (id, name, email) VALUES
    (user_youlee, 'Youlee Hwang', 'youleewh@email.com'),
    (user_riona, 'Riona Wong', 'riona.wong1128@email.com'),
    (user_navneet, 'Navneet Randhawa', 'nkrandhawa13@email.com'),
    (user_jenny, 'Jenny Jiang', 'jjiang95@email.com'),
    (user_cheery, 'Cheery Huang', 'cheery@email.com'),
    (user_szeki, 'Szeki Ho', 'szeki.ho93@email.com');

  -- Create trip with guest field schema
  INSERT INTO trips (id, name, location, start_at, end_at, description, created_by, guest_field_schema) VALUES
    (
      trip_id,
      'Cheery''s Bachelorette',
      'Las Vegas',
      '2026-05-14 12:00:00+00',
      '2026-05-17 12:00:00+00',
      '',
      owner_id,
      '[
        {"label": "Phone Number", "type": "tel", "id": "74381a6f-f865-4b51-9e33-c3eb72e42662"},
        {"label": "Room Number", "type": "number", "id": "0e01f0ef-f083-4916-8fa6-a6e721691261"},
        {"label": "Arrival", "type": "text", "id": "1e6392f4-b0bf-446f-bfc8-2496533dd2f5"},
        {"label": "Departure", "type": "text", "id": "43f573a3-c1b0-44ec-a1dd-d58dc37f5bf0"},
        {"label": "Notes", "type": "textarea", "id": "628a44be-d76f-4ce4-bfcf-115e7309a084"}
      ]'::JSONB
    );

  -- Create memberships
  INSERT INTO memberships (trip_id, user_id, role, account_status) VALUES
    (trip_id, owner_id, 'MOH_ADMIN', 'CLAIMED'),
    (trip_id, user_youlee, 'GUEST_CONFIRMED', 'CLAIMED'),
    (trip_id, user_riona, 'GUEST_CONFIRMED', 'CLAIMED'),
    (trip_id, user_navneet, 'GUEST_CONFIRMED', 'CLAIMED'),
    (trip_id, user_jenny, 'GUEST_CONFIRMED', 'CLAIMED'),
    (trip_id, user_cheery, 'GUEST_CONFIRMED', 'CLAIMED'),
    (trip_id, user_szeki, 'GUEST_CONFIRMED', 'CLAIMED');

  -- Create events
  INSERT INTO events (id, trip_id, title, description, location, start_at, end_at, status, provider, attendee_user_ids) VALUES
    (
      event_hotel,
      trip_id,
      'Stay at Vdara',
      'Book 2 rooms',
      'Las Vegas Strip',
      '2026-05-14 15:00:00+00',
      '2026-05-17 15:00:00+00',
      'CONFIRMED',
      'Vdara Hotel & Spa',
      ARRAY[owner_id, user_youlee, user_navneet, user_jenny, user_cheery]::UUID[]
    ),
    (
      event_dinner,
      trip_id,
      'Fancy Dinner',
      'Asian food',
      'TBD',
      '2026-05-17 01:00:00+00',
      '2026-05-17 04:00:00+00',
      'DRAFT',
      NULL,
      ARRAY[owner_id, user_youlee, user_riona, user_navneet, user_jenny, user_szeki, user_cheery]::UUID[]
    ),
    (
      event_brunch,
      trip_id,
      'Party Brunch',
      '',
      'TBD',
      '2026-05-15 19:00:00+00',
      '2026-05-15 21:00:00+00',
      'DRAFT',
      NULL,
      ARRAY[owner_id, user_youlee, user_riona, user_navneet, user_jenny, user_szeki]::UUID[]
    ),
    (
      event_edc,
      trip_id,
      'EDC!!',
      '',
      'EDC',
      '2026-05-16 02:00:00+00',
      '2026-02-21 11:00:00+00',
      'DRAFT',
      NULL,
      ARRAY[owner_id, user_youlee, user_riona, user_szeki]::UUID[]
    ),
    (
      event_spa,
      trip_id,
      'Spa Date',
      '',
      'TBD',
      '2026-05-16 22:00:00+00',
      '2026-02-21 01:43:28.357+00',
      'DRAFT',
      NULL,
      ARRAY[]::UUID[]
    );

  -- Create tasks
  INSERT INTO tasks (id, trip_id, title, description, status, priority, assignee_user_ids, due_at, related_event_id) VALUES
    (
      '2f82a495-5735-4c20-b358-e4148a974f6e',
      trip_id,
      'Book Hotel',
      'Book 2 rooms',
      'DONE',
      'HIGH',
      ARRAY[owner_id]::UUID[],
      '2026-02-01 00:00:00+00',
      event_hotel
    ),
    (
      '25cab4ac-bbfb-4092-a839-befa8b0841f5',
      trip_id,
      'Book Dinner Reservations',
      '',
      'TODO',
      'HIGH',
      ARRAY[owner_id]::UUID[],
      '2026-03-14 00:00:00+00',
      event_dinner
    ),
    (
      'df77804e-d0e0-46c0-97c8-6ba247e4c466',
      trip_id,
      'Book Party Brunch',
      '',
      'TODO',
      'HIGH',
      ARRAY[owner_id]::UUID[],
      '2026-03-14 00:00:00+00',
      event_brunch
    ),
    (
      '899abbb2-3ceb-4aa1-82b1-48714419fbd7',
      trip_id,
      'Get EDC Tickets',
      '',
      'TODO',
      'HIGH',
      ARRAY[owner_id, user_youlee, user_riona, user_szeki]::UUID[],
      '2026-05-01 00:00:00+00',
      event_edc
    ),
    (
      'dd168641-b04f-4683-9b0c-0d842443e463',
      trip_id,
      'Make Large Kyle Head Cutouts',
      'Need at least 1 per person? Maybe 10 total',
      'TODO',
      'MEDIUM',
      ARRAY[]::UUID[],
      '2026-05-10 00:00:00+00',
      NULL
    ),
    (
      '6f1c2eea-654d-4f32-a957-921c9dfc0843',
      trip_id,
      'Buy Bachelorette Sashes',
      '',
      'TODO',
      'MEDIUM',
      ARRAY[]::UUID[],
      '2026-05-20 00:00:00+00',
      NULL
    ),
    (
      '0547ef22-5d14-4d60-a289-dbae40cf3e38',
      trip_id,
      'Book: Book a Spa',
      '',
      'TODO',
      'MEDIUM',
      ARRAY[owner_id]::UUID[],
      '2026-04-01 00:00:00+00',
      event_spa
    ),
    (
      '0f62a6a5-dc45-43bd-af42-58e8dc432bf1',
      trip_id,
      'Create Genderbender Power Point',
      'Submit photos of yourself',
      'TODO',
      'MEDIUM',
      ARRAY[user_youlee, user_riona, user_navneet, user_jenny, user_szeki, owner_id]::UUID[],
      '2026-04-01 00:00:00+00',
      NULL
    ),
    (
      '68da2590-b936-4555-96ed-036d223e9d1a',
      trip_id,
      'Book Transportation to EDC',
      '',
      'TODO',
      'HIGH',
      ARRAY[owner_id]::UUID[],
      '2026-03-01 00:00:00+00',
      NULL
    ),
    (
      '8c4b59b2-e5ea-4bea-844e-24b824144e0c',
      trip_id,
      'Buy Photo Album',
      'Should fit 4x6 images',
      'TODO',
      'MEDIUM',
      ARRAY[]::UUID[],
      '2026-05-10 00:00:00+00',
      NULL
    ),
    (
      'a8fcc05a-c978-4ab4-86ba-19680cee7ac4',
      trip_id,
      'Have Kyle film video',
      'Audit these questions (Questions for Kyle):

💕 Part 1: Sweet & Sentimental (Start Here)
These set the tone warm and safe.
What was your first impression of Cheery?
When did you know she was "the one"?
What''s something she does that always makes you smile?
What''s your favorite memory together?
What''s one thing she doesn''t realize you admire about her?
What''s something you''re most excited about in married life?
What''s her best quality as a partner?
What''s something she''s better at than you?

😂 Part 2: Light & Playful
Who said "I love you" first?
Who takes longer to get ready?
Who is more dramatic?
Who is more likely to start a random project at 10pm?
Who is the better driver?
Who is more stubborn?
Who spends more money?
Who is more likely to forget where they parked?
Who plans the trips?
Who is more likely to win an argument?

🧠 Part 3: "Details Only He Should Know"
These are fun for guessing tension.
What''s Cheery''s go-to comfort order?
What''s her Starbucks order?
What''s her biggest pet peeve?
What''s her favorite way to relax?
What''s one thing she always overpacks?
What''s her most-used phrase?
What''s her love language?

🎥 Recording Instructions for the Groom

Please answer each question in short video clips (10–20 seconds each).
Don''t overthink it. Just be honest and natural.
Start each answer by repeating the question number.

Have him:
Record vertically
In good lighting
Send via Google Drive or AirDrop

🥂 How to Play It
Ask bride the question.
She answers.
Play groom''s video.
Crowd reacts.
Keep score if you want.

Light "consequences":
Wrong answer → take a sip
Right answer → someone else sips',
      'TODO',
      'HIGH',
      ARRAY[]::UUID[],
      '2026-05-03 00:00:00+00',
      NULL
    );

  -- Create budget items
  INSERT INTO budget_items (
    id, trip_id, title, category, planned_amount, actual_amount,
    currency, status, responsible_user_id, paid_by_user_id,
    notes, cost_mode, split_type, split_attendee_user_ids,
    related_event_id, related_task_id
  ) VALUES
    (
      'ded17356-ec3d-4e36-9988-df11b51b319a',
      trip_id,
      'Book Hotel',
      'ACCOMMODATION',
      4500.00,
      3886.17,
      'USD',
      'PAID',
      owner_id,
      owner_id,
      '',
      NULL,
      NULL,
      NULL,
      event_hotel,
      '2f82a495-5735-4c20-b358-e4148a974f6e'
    ),
    (
      '8806cf07-0e32-4164-b07e-d29243fd1303',
      trip_id,
      'Book Dinner Reservations',
      'RESTAURANT',
      900.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'PER_PERSON',
      'EQUAL',
      NULL,
      event_dinner,
      '25cab4ac-bbfb-4092-a839-befa8b0841f5'
    ),
    (
      'b8a43d5d-273f-4f87-a21e-fdd7b3ed609c',
      trip_id,
      'Book Party Brunch',
      'RESTAURANT',
      900.00,
      0.00,
      'USD',
      'PLANNED',
      owner_id,
      NULL,
      '',
      'PER_PERSON',
      'EQUAL',
      NULL,
      event_brunch,
      'df77804e-d0e0-46c0-97c8-6ba247e4c466'
    ),
    (
      '5b59386c-ddd8-40b6-9a1b-3c18be5701f0',
      trip_id,
      'EDC Tickets',
      'ACTIVITY',
      1800.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'PER_PERSON',
      'EQUAL',
      NULL,
      event_edc,
      '899abbb2-3ceb-4aa1-82b1-48714419fbd7'
    ),
    (
      'd3ed6748-cad4-4d9c-b84e-33b31e581fab',
      trip_id,
      'Buy Large Kyle Head Cutouts',
      'DECORATION',
      10.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'TOTAL',
      'EQUAL',
      ARRAY[owner_id, user_youlee, user_riona, user_navneet, user_jenny, user_szeki]::UUID[],
      NULL,
      'dd168641-b04f-4683-9b0c-0d842443e463'
    ),
    (
      'b4f7a807-7c67-437b-803b-7916cf93f127',
      trip_id,
      'Buy Bachelorette Sashes',
      'DECORATION',
      10.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'TOTAL',
      'EQUAL',
      ARRAY[owner_id, user_youlee, user_riona, user_navneet, user_jenny, user_szeki]::UUID[],
      NULL,
      '6f1c2eea-654d-4f32-a957-921c9dfc0843'
    ),
    (
      '36664b2a-4343-4c98-ae1e-237728080468',
      trip_id,
      'Spa',
      'ACTIVITY',
      100.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'PER_PERSON',
      'EQUAL',
      NULL,
      event_spa,
      '0547ef22-5d14-4d60-a289-dbae40cf3e38'
    ),
    (
      'af6ae4c3-f4f3-4d1d-802f-954994ab1706',
      trip_id,
      'Book Transportation to EDC',
      'TRANSPORT',
      1000.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      'Hopefully a party bus?',
      'PER_PERSON',
      'EQUAL',
      ARRAY[owner_id, user_youlee, user_riona, user_cheery, user_szeki]::UUID[],
      NULL,
      '68da2590-b936-4555-96ed-036d223e9d1a'
    ),
    (
      'e1a59b41-7863-49c9-b149-97bcf9e1fa7c',
      trip_id,
      'Buy Photo Album',
      'DECORATION',
      20.00,
      0.00,
      'USD',
      'PLANNED',
      NULL,
      NULL,
      '',
      'TOTAL',
      'EQUAL',
      ARRAY[owner_id, user_youlee, user_riona, user_navneet, user_jenny, user_szeki]::UUID[],
      NULL,
      '8c4b59b2-e5ea-4bea-844e-24b824144e0c'
    );

  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE 'Trip ID: %', trip_id;
  RAISE NOTICE 'Remember to update user custom fields manually via the app UI';

END $$;
