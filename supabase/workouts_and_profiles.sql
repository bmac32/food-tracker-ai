-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query)
-- before using the workout-logging feature. This project has no migration
-- tooling configured, so there's no automated way to apply this for you.

-- -------------------------
-- WORKOUTS
-- -------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  workout_type text not null check (
    workout_type in (
      'running', 'walking', 'cycling', 'swimming',
      'weightlifting', 'yoga', 'hiit', 'sports'
    )
  ),
  duration_minutes integer not null check (duration_minutes > 0),
  calories_burned integer not null check (calories_burned >= 0),
  photo_url text,
  note text
);

alter table public.workouts enable row level security;

drop policy if exists "Users can view their own workouts" on public.workouts;
create policy "Users can view their own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workouts" on public.workouts;
create policy "Users can insert their own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workouts" on public.workouts;
create policy "Users can update their own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own workouts" on public.workouts;
create policy "Users can delete their own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- Enables the MealFeed realtime subscription (mirrors whatever setup the
-- `meals` table already has). Wrapped so it's safe to re-run and safe to
-- ignore if your project manages realtime per-table via the Dashboard
-- instead (Database > Replication).
do $$
begin
  alter publication supabase_realtime add table public.workouts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- -------------------------
-- USER PROFILES
-- -------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight numeric,        -- lbs, matches the rest of the app's existing unit convention
  height numeric,        -- inches
  age integer,
  activity_level text,   -- "Not very active" | "Somewhat active" | "Very active"
  goal text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);
