-- Weight log + trend (backlog #9): manual entry, trend in goals, ED-safe display.
-- Goals derive from weight, so the log keeps the weight fresh — stale weight
-- rots the goals. Run once in the Supabase SQL editor.

create table if not exists weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_lbs numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

alter table weight_log enable row level security;

drop policy if exists "own weight select" on weight_log;
create policy "own weight select" on weight_log
  for select using (auth.uid() = user_id);
drop policy if exists "own weight insert" on weight_log;
create policy "own weight insert" on weight_log
  for insert with check (auth.uid() = user_id);
drop policy if exists "own weight update" on weight_log;
create policy "own weight update" on weight_log
  for update using (auth.uid() = user_id);

-- Stamp the weight the goals were generated from, so the app can notice
-- when the weight moves on and the goals are stale.
alter table user_goals
  add column if not exists weight_lbs numeric;

-- ED-safe display preference: hide the numbers, show the trend only.
alter table user_profiles
  add column if not exists hide_weight_numbers boolean not null default false;
