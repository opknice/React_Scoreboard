-- Player roster and per-match goal statistics.  Every row carries league_id so
-- the database can enforce that data never crosses the active league boundary.

-- Keep the existing league/team deletion semantics explicit. This also makes
-- the migration safe when the earlier FK hardening migration was not applied
-- to the database represented by the backup.
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_league_id_fkey,
  ADD CONSTRAINT teams_league_id_fkey
    FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_league_id_fkey,
  ADD CONSTRAINT matches_league_id_fkey
    FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_team_a_id_fkey,
  ADD CONSTRAINT matches_team_a_id_fkey
    FOREIGN KEY (team_a_id) REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_team_b_id_fkey,
  ADD CONSTRAINT matches_team_b_id_fkey
    FOREIGN KEY (team_b_id) REFERENCES public.teams(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teams_id_league_id_key'
      AND conrelid = 'public.teams'::regclass
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_id_league_id_key UNIQUE (id, league_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_id_league_id_key'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_id_league_id_key UNIQUE (id, league_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  jersey_number integer NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  position text NOT NULL CHECK (position IN ('GK', 'DF', 'MF', 'FW')),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_team_league_fkey
    FOREIGN KEY (team_id, league_id) REFERENCES public.teams(id, league_id) ON DELETE CASCADE,
  CONSTRAINT players_team_jersey_unique UNIQUE (team_id, jersey_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_id_league_id_key'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_id_league_id_key UNIQUE (id, league_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  team_id uuid NOT NULL,
  goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_match_stats_match_league_fkey
    FOREIGN KEY (match_id, league_id) REFERENCES public.matches(id, league_id) ON DELETE CASCADE,
  CONSTRAINT player_match_stats_player_league_fkey
    FOREIGN KEY (player_id, league_id) REFERENCES public.players(id, league_id) ON DELETE CASCADE,
  CONSTRAINT player_match_stats_team_fkey
    FOREIGN KEY (team_id, league_id) REFERENCES public.teams(id, league_id) ON DELETE CASCADE,
  CONSTRAINT player_match_stats_unique UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS players_league_team_idx ON public.players(league_id, team_id);
CREATE INDEX IF NOT EXISTS player_match_stats_league_player_idx ON public.player_match_stats(league_id, player_id);

CREATE OR REPLACE FUNCTION public.prevent_player_team_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.league_id IS DISTINCT FROM OLD.league_id THEN
    RAISE EXCEPTION 'A player cannot be moved to another team or league';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_player_team_change_trigger ON public.players;
CREATE TRIGGER prevent_player_team_change_trigger
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.prevent_player_team_change();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_publication p ON p.oid = pr.prpubid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'players') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid JOIN pg_publication p ON p.oid = pr.prpubid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'player_match_stats') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.player_match_stats;
    END IF;
  END IF;
END $$;

-- A stat may only be recorded when the player belongs to the selected team and
-- that team is one of the two teams in the selected match.
CREATE OR REPLACE FUNCTION public.validate_player_match_stat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  player_team uuid;
  match_team_a uuid;
  match_team_b uuid;
BEGIN
  SELECT p.team_id INTO player_team
  FROM public.players p
  WHERE p.id = NEW.player_id AND p.league_id = NEW.league_id;
  IF player_team IS NULL OR player_team <> NEW.team_id THEN
    RAISE EXCEPTION 'Player and stat team must belong to the same league and team';
  END IF;

  SELECT m.team_a_id, m.team_b_id INTO match_team_a, match_team_b
  FROM public.matches m
  WHERE m.id = NEW.match_id AND m.league_id = NEW.league_id;
  IF NEW.team_id IS DISTINCT FROM match_team_a AND NEW.team_id IS DISTINCT FROM match_team_b THEN
    RAISE EXCEPTION 'Player stat team is not participating in this match';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_player_match_stat_trigger ON public.player_match_stats;
CREATE TRIGGER validate_player_match_stat_trigger
  BEFORE INSERT OR UPDATE ON public.player_match_stats
  FOR EACH ROW EXECUTE FUNCTION public.validate_player_match_stat();

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read players" ON public.players;
DROP POLICY IF EXISTS "Public can read player match stats" ON public.player_match_stats;
DROP POLICY IF EXISTS "League owners can create players" ON public.players;
DROP POLICY IF EXISTS "League owners can update players" ON public.players;
DROP POLICY IF EXISTS "League owners can delete players" ON public.players;
DROP POLICY IF EXISTS "League owners can create player stats" ON public.player_match_stats;
DROP POLICY IF EXISTS "League owners can update player stats" ON public.player_match_stats;
DROP POLICY IF EXISTS "League owners can delete player stats" ON public.player_match_stats;

CREATE POLICY "Public can read players" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read player match stats" ON public.player_match_stats FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "League owners can create players" ON public.players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));
CREATE POLICY "League owners can update players" ON public.players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = players.league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));
CREATE POLICY "League owners can delete players" ON public.players FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = players.league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));

CREATE POLICY "League owners can create player stats" ON public.player_match_stats FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));
CREATE POLICY "League owners can update player stats" ON public.player_match_stats FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = player_match_stats.league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));
CREATE POLICY "League owners can delete player stats" ON public.player_match_stats FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = player_match_stats.league_id AND lower(l.created_by) = lower((SELECT auth.jwt() ->> 'email'))));
