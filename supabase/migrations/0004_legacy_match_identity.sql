-- Makes repeated Firebase JSON imports deterministic.
-- Firebase push IDs are unique within each legacy league database.

create unique index if not exists matches_league_legacy_id_unique_idx
  on public.matches (league_id, legacy_firebase_id)
  where legacy_firebase_id is not null;
