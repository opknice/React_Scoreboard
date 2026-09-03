-- Harden data mutations for Supabase Auth.
--
-- The OBS/Standalone pages intentionally read public scoreboard data without a
-- user session, so SELECT remains public. All mutations require an
-- authenticated Supabase user who owns the league.
--
-- Current schema stores the owner email in leagues.created_by. The comparison
-- is normalized to lowercase to match LeagueService's input normalization.

-- ------------------------------------------------------------------------------
-- 1. LEAGUES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow manage leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "League owners can update leagues" ON public.leagues;
DROP POLICY IF EXISTS "League owners can delete leagues" ON public.leagues;

CREATE POLICY "Authenticated users can create leagues"
  ON public.leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND lower(created_by) = lower((SELECT auth.jwt() ->> 'email'))
  );

CREATE POLICY "League owners can update leagues"
  ON public.leagues
  FOR UPDATE
  TO authenticated
  USING (
    lower(created_by) = lower((SELECT auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    created_by IS NOT NULL
    AND lower(created_by) = lower((SELECT auth.jwt() ->> 'email'))
  );

CREATE POLICY "League owners can delete leagues"
  ON public.leagues
  FOR DELETE
  TO authenticated
  USING (
    lower(created_by) = lower((SELECT auth.jwt() ->> 'email'))
  );

-- ------------------------------------------------------------------------------
-- 2. TEAMS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow manage teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can create teams in owned leagues" ON public.teams;
DROP POLICY IF EXISTS "League owners can update teams" ON public.teams;
DROP POLICY IF EXISTS "League owners can delete teams" ON public.teams;

CREATE POLICY "Authenticated users can create teams in owned leagues"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "League owners can update teams"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = teams.league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "League owners can delete teams"
  ON public.teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = teams.league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

-- ------------------------------------------------------------------------------
-- 3. MATCHES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow manage matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can create matches in owned leagues" ON public.matches;
DROP POLICY IF EXISTS "League owners can update matches" ON public.matches;
DROP POLICY IF EXISTS "League owners can delete matches" ON public.matches;

CREATE POLICY "Authenticated users can create matches in owned leagues"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "League owners can update matches"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = matches.league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "League owners can delete matches"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leagues
      WHERE public.leagues.id = matches.league_id
        AND lower(public.leagues.created_by) = lower((SELECT auth.jwt() ->> 'email'))
    )
  );

-- ------------------------------------------------------------------------------
-- 4. STORAGE: public logo read, authenticated write only
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow upload team logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update team logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete team logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload team logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update team logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete team logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload team logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND name LIKE 'logos/%'
  );

CREATE POLICY "Authenticated users can update team logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND name LIKE 'logos/%'
  )
  WITH CHECK (
    bucket_id = 'team-logos'
    AND name LIKE 'logos/%'
  );

CREATE POLICY "Authenticated users can delete team logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND name LIKE 'logos/%'
  );
