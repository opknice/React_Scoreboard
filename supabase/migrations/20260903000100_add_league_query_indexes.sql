-- Indexes for the query patterns used by LeagueService.
-- These indexes improve reads without changing application behavior or RLS.

CREATE INDEX IF NOT EXISTS idx_leagues_created_by_created_at
  ON public.leagues (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teams_league_id_name
  ON public.teams (league_id, name);

CREATE INDEX IF NOT EXISTS idx_matches_league_id_match_number
  ON public.matches (league_id, match_number);
