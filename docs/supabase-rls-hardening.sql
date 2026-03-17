-- Bachelorette Planner - RLS hardening (safe to re-run)
-- Run this in Supabase SQL Editor on your production project.

begin;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can evaluate membership safely)
-- ---------------------------------------------------------------------------
create or replace function public.bp_is_trip_member(p_trip uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  has_user_id boolean;
  has_profile_id boolean;
  ok boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.memberships') is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'profile_id'
  ) into has_profile_id;

  if has_user_id then
    execute 'select exists(
      select 1
      from public.memberships m
      where m.trip_id = $1 and m.user_id = $2
    )'
    into ok
    using p_trip, auth.uid();
    return coalesce(ok, false);
  end if;

  if has_profile_id then
    execute 'select exists(
      select 1
      from public.memberships m
      where m.trip_id = $1 and m.profile_id = $2
    )'
    into ok
    using p_trip, auth.uid();
    return coalesce(ok, false);
  end if;

  if to_regclass('public.trips') is not null then
    select exists (
      select 1
      from public.trips t
      where t.id = p_trip
        and t.created_by = auth.uid()
    ) into ok;
    if coalesce(ok, false) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.bp_is_trip_admin(p_trip uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  has_user_id boolean;
  has_profile_id boolean;
  ok boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.memberships') is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'profile_id'
  ) into has_profile_id;

  if has_user_id then
    execute 'select exists(
      select 1
      from public.memberships m
      where m.trip_id = $1
        and m.user_id = $2
        and m.role in (''MOH_ADMIN'', ''ADMIN'', ''OWNER'')
    )'
    into ok
    using p_trip, auth.uid();
    return coalesce(ok, false);
  end if;

  if has_profile_id then
    execute 'select exists(
      select 1
      from public.memberships m
      where m.trip_id = $1
        and m.profile_id = $2
        and m.role in (''MOH_ADMIN'', ''ADMIN'', ''OWNER'')
    )'
    into ok
    using p_trip, auth.uid();
    return coalesce(ok, false);
  end if;

  return false;
end;
$$;

create or replace function public.bp_can_view_user(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  has_user_id boolean;
  has_profile_id boolean;
  ok boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_user = auth.uid() then
    return true;
  end if;

  if to_regclass('public.memberships') is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'profile_id'
  ) into has_profile_id;

  if has_user_id then
    execute 'select exists(
      select 1
      from public.memberships mine
      join public.memberships other on other.trip_id = mine.trip_id
      where mine.user_id = $1
        and other.user_id = $2
    )'
    into ok
    using auth.uid(), p_user;
    return coalesce(ok, false);
  end if;

  if has_profile_id then
    execute 'select exists(
      select 1
      from public.memberships mine
      join public.memberships other on other.trip_id = mine.trip_id
      where mine.profile_id = $1
        and other.profile_id = $2
    )'
    into ok
    using auth.uid(), p_user;
    return coalesce(ok, false);
  end if;

  return false;
end;
$$;

grant execute on function public.bp_is_trip_member(uuid) to anon, authenticated, service_role;
grant execute on function public.bp_is_trip_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.bp_can_view_user(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS + drop existing policies on app tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
  tables text[] := array[
    'users',
    'profiles',
    'trips',
    'memberships',
    'events',
    'tasks',
    'budget_items',
    'checklist_items',
    'polls',
    'photos',
    'bookings',
    'invites',
    'moodboard_notes',
    'moodboard_note_images'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = t
      loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- USERS / PROFILES
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.users') is not null then
    execute '
      create policy users_select_visible
      on public.users
      for select
      to authenticated
      using (public.bp_can_view_user(id))
    ';
    execute '
      create policy users_insert_self
      on public.users
      for insert
      to authenticated
      with check (id = auth.uid())
    ';
    execute '
      create policy users_update_self
      on public.users
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid())
    ';
  end if;

  if to_regclass('public.profiles') is not null then
    execute '
      create policy profiles_select_visible
      on public.profiles
      for select
      to authenticated
      using (public.bp_can_view_user(id))
    ';
    execute '
      create policy profiles_insert_self
      on public.profiles
      for insert
      to authenticated
      with check (id = auth.uid())
    ';
    execute '
      create policy profiles_update_self
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid())
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TRIPS
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.trips') is not null then
    execute '
      create policy trips_select_member
      on public.trips
      for select
      to authenticated
      using (public.bp_is_trip_member(id) or created_by = auth.uid())
    ';
    execute '
      create policy trips_insert_owner
      on public.trips
      for insert
      to authenticated
      with check (created_by = auth.uid())
    ';
    execute '
      create policy trips_update_admin
      on public.trips
      for update
      to authenticated
      using (public.bp_is_trip_admin(id) or created_by = auth.uid())
      with check (public.bp_is_trip_admin(id) or created_by = auth.uid())
    ';
    execute '
      create policy trips_delete_admin
      on public.trips
      for delete
      to authenticated
      using (public.bp_is_trip_admin(id) or created_by = auth.uid())
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- MEMBERSHIPS
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.memberships') is not null then
    execute '
      create policy memberships_select_member
      on public.memberships
      for select
      to authenticated
      using (public.bp_is_trip_member(trip_id))
    ';
    execute '
      create policy memberships_insert_admin
      on public.memberships
      for insert
      to authenticated
      with check (public.bp_is_trip_admin(trip_id))
    ';
    execute '
      create policy memberships_update_admin
      on public.memberships
      for update
      to authenticated
      using (public.bp_is_trip_admin(trip_id))
      with check (public.bp_is_trip_admin(trip_id))
    ';
    execute '
      create policy memberships_delete_admin
      on public.memberships
      for delete
      to authenticated
      using (public.bp_is_trip_admin(trip_id))
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Trip-scoped data tables (member read/write for collaboration)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  has_trip_id boolean;
  tables text[] := array[
    'events',
    'tasks',
    'budget_items',
    'checklist_items',
    'polls',
    'photos',
    'bookings',
    'moodboard_notes'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = t
          and column_name = 'trip_id'
      ) into has_trip_id;

      if has_trip_id then
        execute format('
          create policy %I
          on public.%I
          for select
          to authenticated
          using (public.bp_is_trip_member(trip_id))
        ', t || '_select_member', t);

        execute format('
          create policy %I
          on public.%I
          for insert
          to authenticated
          with check (public.bp_is_trip_member(trip_id))
        ', t || '_insert_member', t);

        execute format('
          create policy %I
          on public.%I
          for update
          to authenticated
          using (public.bp_is_trip_member(trip_id))
          with check (public.bp_is_trip_member(trip_id))
        ', t || '_update_member', t);

        execute format('
          create policy %I
          on public.%I
          for delete
          to authenticated
          using (public.bp_is_trip_member(trip_id))
        ', t || '_delete_member', t);
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- INVITES (admin-only)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.invites') is not null then
    execute '
      create policy invites_select_admin
      on public.invites
      for select
      to authenticated
      using (public.bp_is_trip_admin(trip_id))
    ';
    execute '
      create policy invites_insert_admin
      on public.invites
      for insert
      to authenticated
      with check (public.bp_is_trip_admin(trip_id))
    ';
    execute '
      create policy invites_update_admin
      on public.invites
      for update
      to authenticated
      using (public.bp_is_trip_admin(trip_id))
      with check (public.bp_is_trip_admin(trip_id))
    ';
    execute '
      create policy invites_delete_admin
      on public.invites
      for delete
      to authenticated
      using (public.bp_is_trip_admin(trip_id))
    ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- MOODBOARD NOTE IMAGES (authorize through parent note -> trip membership)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.moodboard_note_images') is not null
     and to_regclass('public.moodboard_notes') is not null then
    execute '
      create policy moodboard_note_images_select_member
      on public.moodboard_note_images
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.moodboard_notes n
          where n.id = moodboard_note_images.note_id
            and public.bp_is_trip_member(n.trip_id)
        )
      )
    ';

    execute '
      create policy moodboard_note_images_insert_member
      on public.moodboard_note_images
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.moodboard_notes n
          where n.id = moodboard_note_images.note_id
            and public.bp_is_trip_member(n.trip_id)
        )
      )
    ';

    execute '
      create policy moodboard_note_images_update_member
      on public.moodboard_note_images
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.moodboard_notes n
          where n.id = moodboard_note_images.note_id
            and public.bp_is_trip_member(n.trip_id)
        )
      )
      with check (
        exists (
          select 1
          from public.moodboard_notes n
          where n.id = moodboard_note_images.note_id
            and public.bp_is_trip_member(n.trip_id)
        )
      )
    ';

    execute '
      create policy moodboard_note_images_delete_member
      on public.moodboard_note_images
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.moodboard_notes n
          where n.id = moodboard_note_images.note_id
            and public.bp_is_trip_member(n.trip_id)
        )
      )
    ';
  end if;
end $$;

commit;

-- Post-check helpers:
-- select schemaname, tablename, policyname, permissive, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
