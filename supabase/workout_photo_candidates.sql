-- ============================================================
-- Photo candidates for the swipeable WORKOUT photo picker
-- Run this in Supabase → SQL Editor → New query.
-- Safe to re-run: the column add is IF NOT EXISTS and the backfill
-- only touches rows that don't have candidates yet.
-- (Mirrors supabase/photo_candidates.sql, which did this for meals.)
-- ============================================================

-- 1) New column on workouts: ordered pool of candidate photo URLs.
alter table public.workouts
  add column if not exists photo_candidates jsonb;

-- 2) Backfill: existing workouts get a single-candidate pool from
--    their current photo_url so old cards keep working unchanged.
update public.workouts
set photo_candidates = jsonb_build_array(photo_url)
where photo_candidates is null
  and photo_url is not null;

-- ============================================================
-- VERIFICATION (run after the above)
-- ============================================================
-- Should return one row: column_name = photo_candidates
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'workouts'
--   and column_name = 'photo_candidates';

-- Spot-check a recent workout (expects a JSON array of URLs)
-- select id, workout_type, photo_url, photo_candidates
-- from public.workouts
-- order by created_at desc
-- limit 3;
