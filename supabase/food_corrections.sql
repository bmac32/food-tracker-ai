-- Food truth loop: "correct once, remembered forever."
-- When she corrects a food's macros ("pickles = 0 fat"), the per-100g values
-- are stored here and win over USDA lab data and AI estimates in all future
-- analyses. Her truth beats every other source.
-- Run this in the Supabase SQL editor (Database -> SQL).

create table if not exists food_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- normalized food name, e.g. "pickles" (lowercased, trimmed)
  food_key text not null,
  protein_per100 numeric not null,
  carbs_per100 numeric not null,
  fat_per100 numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, food_key)
);

create index if not exists food_corrections_user_food
  on food_corrections(user_id, food_key);

alter table food_corrections enable row level security;

drop policy if exists "Users manage own food corrections" on food_corrections;
create policy "Users manage own food corrections" on food_corrections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
