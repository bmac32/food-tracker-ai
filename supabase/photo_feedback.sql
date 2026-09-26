-- Photo learning: remembers which photos she picked (or rejected) per dish,
-- so future lookups for similar dishes lead with her past picks.
-- Run this in the Supabase SQL editor (Database -> SQL).

create table if not exists photo_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_key text not null,
  meal_name text,
  foods text[],
  photo_url text not null,
  verdict text not null check (verdict in ('chosen', 'liked', 'disliked')),
  created_at timestamptz not null default now()
);

create index if not exists photo_feedback_user_dish
  on photo_feedback(user_id, dish_key);

alter table photo_feedback enable row level security;

drop policy if exists "Users manage own photo feedback" on photo_feedback;
create policy "Users manage own photo feedback" on photo_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
