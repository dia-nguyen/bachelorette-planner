-- Fix the trigger to better handle name field from OAuth providers
-- AND handle stub user email conflicts
-- Run this to update the existing trigger

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_id UUID;
BEGIN
  -- Check if a user with this email already exists (stub user waiting to be claimed)
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE email = NEW.email;

  -- If a stub user exists with this email, skip insertion
  -- The auth callback will handle merging the stub user into this auth account
  IF existing_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Otherwise, insert the new user (no stub user exists)
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1),
      'Guest'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    name = COALESCE(
      EXCLUDED.name,
      public.users.name
    ),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function was updated
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';
