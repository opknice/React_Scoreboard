-- ==============================================================================
-- Migration: Fix Foreign Key Constraints, RLS Policies & Realtime Setup
-- Date: 2026-09-02
-- Description:
--   1. ปรับ Foreign Key ให้รองรับ ON DELETE CASCADE / ON DELETE SET NULL
--   2. ตั้งค่า RLS ให้ OBS Overlays (public/anon) สามารถอ่านข้อมูลลีก ตารางแข่ง และทีมได้
--   3. เปิดใช้งาน Supabase Realtime สำหรับตาราง leagues, teams, matches
--   4. สร้าง Storage Bucket 'team-logos' (ถ้ายังไม่มี) พร้อม Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FOREIGN KEY CONSTRAINTS (CASCADE / SET NULL)
-- ------------------------------------------------------------------------------

-- ปรับ teams.league_id -> leagues(id) ON DELETE CASCADE
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_league_id_fkey,
  ADD CONSTRAINT teams_league_id_fkey
    FOREIGN KEY (league_id)
    REFERENCES public.leagues(id)
    ON DELETE CASCADE;

-- ปรับ matches.league_id -> leagues(id) ON DELETE CASCADE
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_league_id_fkey,
  ADD CONSTRAINT matches_league_id_fkey
    FOREIGN KEY (league_id)
    REFERENCES public.leagues(id)
    ON DELETE CASCADE;

-- ปรับ matches.team_a_id -> teams(id) ON DELETE SET NULL (เมื่อลบทีม ไม่ให้ลบแมตช์ แต่ให้เป็น NULL)
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_team_a_id_fkey,
  ADD CONSTRAINT matches_team_a_id_fkey
    FOREIGN KEY (team_a_id)
    REFERENCES public.teams(id)
    ON DELETE SET NULL;

-- ปรับ matches.team_b_id -> teams(id) ON DELETE SET NULL
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_team_b_id_fkey,
  ADD CONSTRAINT matches_team_b_id_fkey
    FOREIGN KEY (team_b_id)
    REFERENCES public.teams(id)
    ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 2.1 Public Read for OBS Overlays & Scoreboard Standalones (Anon / Authenticated)
DROP POLICY IF EXISTS "Allow public read leagues" ON public.leagues;
CREATE POLICY "Allow public read leagues"
  ON public.leagues
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read teams" ON public.teams;
CREATE POLICY "Allow public read teams"
  ON public.teams
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read matches" ON public.matches;
CREATE POLICY "Allow public read matches"
  ON public.matches
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

-- 2.2 Manage Permissions (Insert, Update, Delete for all valid clients / anon or authenticated based on app configuration)
DROP POLICY IF EXISTS "Allow manage leagues" ON public.leagues;
CREATE POLICY "Allow manage leagues"
  ON public.leagues
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manage teams" ON public.teams;
CREATE POLICY "Allow manage teams"
  ON public.teams
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manage matches" ON public.matches;
CREATE POLICY "Allow manage matches"
  ON public.matches
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. SUPABASE REALTIME REPLICATION
-- ------------------------------------------------------------------------------

-- เปิด Realtime สำหรับตาราง leagues, teams, matches
DO $$
BEGIN
  -- ตรวจสอบและเพิ่มตารางเข้า publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'leagues'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leagues;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. STORAGE BUCKET 'team-logos' (Public Bucket & Policies)
-- ------------------------------------------------------------------------------

-- สร้าง Bucket 'team-logos' ถ้ายังไม่มี
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy ให้ทุกคนอ่านรูปโลโก้ได้ (Public Read)
DROP POLICY IF EXISTS "Allow public read team logos" ON storage.objects;
CREATE POLICY "Allow public read team logos"
  ON storage.objects
  FOR SELECT
  TO public, anon, authenticated
  USING (bucket_id = 'team-logos');

-- Policy ให้อนุญาตอัปโหลดโลโก้ได้
DROP POLICY IF EXISTS "Allow upload team logos" ON storage.objects;
CREATE POLICY "Allow upload team logos"
  ON storage.objects
  FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Allow update team logos" ON storage.objects;
CREATE POLICY "Allow update team logos"
  ON storage.objects
  FOR UPDATE
  TO public, anon, authenticated
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Allow delete team logos" ON storage.objects;
CREATE POLICY "Allow delete team logos"
  ON storage.objects
  FOR DELETE
  TO public, anon, authenticated
  USING (bucket_id = 'team-logos');
