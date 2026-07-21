-- Fixes the pre-existing tables flagged by Supabase's Security Advisor
-- (meals, user_goals, shared_meals). Run this once in the SQL Editor.
-- Safe to re-run: it drops and recreates policies rather than assuming
-- what's already there.

-- -------------------------
-- MEALS
-- existing policies use USING (true) — everyone can read/write everyone's
-- meals. Replace with policies scoped to the owning user.
-- -------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'meals'
  loop
    execute format('drop policy %I on public.meals', pol.policyname);
  end loop;
end $$;

alter table public.meals enable row level security;

create policy "Users can view their own meals"
  on public.meals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own meals"
  on public.meals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own meals"
  on public.meals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own meals"
  on public.meals for delete
  using (auth.uid() = user_id);

-- -------------------------
-- USER_GOALS
-- RLS is currently disabled (policies exist but are inactive). Ensure a
-- user_id column exists with a sensible default, then enable RLS.
--
-- ⚠️ Heads up: any existing rows with a NULL user_id (likely, since the
-- app has never set it) will become invisible to everyone once RLS is on
-- — that's the correct, private outcome, but it means your currently
-- saved goals may appear to reset to the app's defaults. Just re-save
-- them once from the "Edit Goals" screen after this runs.
-- -------------------------
alter table public.user_goals
  add column if not exists user_id uuid references auth.users(id);

alter table public.user_goals
  alter column user_id set default auth.uid();

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_goals'
  loop
    execute format('drop policy %I on public.user_goals', pol.policyname);
  end loop;
end $$;

alter table public.user_goals enable row level security;

create policy "Users can view their own goals"
  on public.user_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.user_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.user_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on public.user_goals for delete
  using (auth.uid() = user_id);

-- -------------------------
-- SHARED_MEALS
-- This table is intentionally public-readable (anyone with a share link
-- views it while logged out) and needs an anonymous "reply" write. So:
--   - SELECT: open to anyone (knowing the row's id is what "having the
--     link" means — same model as a Google Docs share link)
--   - INSERT: only the owner of the referenced meal (in practice your
--     /api/share-meal route uses the service role key and bypasses this
--     anyway, but it's here for correctness if anything else ever calls
--     it with the anon key)
--   - UPDATE: open, but column-locked so an anonymous replier can only
--     ever change reply_message — not the original message, sender, or
--     which meal it points to
-- -------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'shared_meals'
  loop
    execute format('drop policy %I on public.shared_meals', pol.policyname);
  end loop;
end $$;

alter table public.shared_meals enable row level security;

create policy "Anyone with the link can view a shared meal"
  on public.shared_meals for select
  using (true);

create policy "Meal owners can create a share"
  on public.shared_meals for insert
  with check (
    exists (
      select 1 from public.meals m
      where m.id = shared_meals.meal_id
        and m.user_id = auth.uid()
    )
  );

create policy "Anyone with the link can reply, nothing else"
  on public.shared_meals for update
  using (true)
  with check (
    meal_id = (select s.meal_id from public.shared_meals s where s.id = shared_meals.id)
    and recipient_email is not distinct from
      (select s.recipient_email from public.shared_meals s where s.id = shared_meals.id)
    and message is not distinct from
      (select s.message from public.shared_meals s where s.id = shared_meals.id)
    and sender_name is not distinct from
      (select s.sender_name from public.shared_meals s where s.id = shared_meals.id)
  );
