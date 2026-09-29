-- Portion learning: the app quietly learns HER typical portion per food,
-- so first-guess portions land near her reality with zero admin work.
-- A portion counts as "learned" (clean number, no "~") once a food has
-- been seen 3+ times AND she has taught it once.
-- Run once in the Supabase SQL editor.

create table if not exists portion_profile (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_key text not null,
  food_label text not null,
  typical_grams numeric not null,
  samples integer not null default 1,
  taught boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, food_key)
);

alter table portion_profile enable row level security;

drop policy if exists "own portions select" on portion_profile;
create policy "own portions select" on portion_profile
  for select using (auth.uid() = user_id);
drop policy if exists "own portions insert" on portion_profile;
create policy "own portions insert" on portion_profile
  for insert with check (auth.uid() = user_id);
drop policy if exists "own portions update" on portion_profile;
create policy "own portions update" on portion_profile
  for update using (auth.uid() = user_id);

-- Atomic upsert with running average. Uses auth.uid() (never a passed-in
-- user id) so one user can never write another user's profile.
-- Absurd gram values are ignored rather than stored.
create or replace function record_portion(
  p_food_key text,
  p_food_label text,
  p_grams numeric,
  p_taught boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  if p_food_key is null or p_food_key = '' then return; end if;
  if not (p_grams > 0 and p_grams <= 3000) then return; end if;
  insert into portion_profile (user_id, food_key, food_label, typical_grams, samples, taught, updated_at)
  values (v_user, p_food_key, left(p_food_label, 80), p_grams, 1, p_taught, now())
  on conflict (user_id, food_key) do update set
    typical_grams = round(
      ((portion_profile.typical_grams * portion_profile.samples) + excluded.typical_grams)
      / (portion_profile.samples + 1),
      1
    ),
    samples = portion_profile.samples + 1,
    taught = portion_profile.taught or excluded.taught,
    food_label = excluded.food_label,
    updated_at = now();
end;
$$;

grant execute on function record_portion(text, text, numeric, boolean) to authenticated;
