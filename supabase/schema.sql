-- ==============================================================================
-- SUPABASE SCHEMA FOR REACT SCOREBOARD SYSTEM
-- Run this script in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create 'leagues' table
CREATE TABLE IF NOT EXISTS public.leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT,
    season TEXT,
    description TEXT,
    created_by TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'teams' table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT,
    logo_url TEXT,
    color_primary TEXT DEFAULT '#ffffff',
    color_secondary TEXT DEFAULT '#000000',
    crop_metadata JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create 'matches' table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    team_a_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_b_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_a_name TEXT NOT NULL,
    team_b_name TEXT NOT NULL,
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'finished' | 'postponed'
    label1 TEXT DEFAULT '',          -- e.g. รอบการแข่งขัน (Round)
    label2 TEXT DEFAULT '',          -- e.g. สัปดาห์ (Matchweek / Day)
    label3 TEXT DEFAULT '',          -- e.g. สนาม (Field / Pitch)
    match_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON public.teams(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_id ON public.matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_match_number ON public.matches(league_id, match_number);

-- 6. Setup Row Level Security (RLS) - Permissive for Anon Key
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (public) or authenticated users
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all for leagues" ON public.leagues;
    CREATE POLICY "Allow all for leagues" ON public.leagues FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for teams" ON public.teams;
    CREATE POLICY "Allow all for teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all for matches" ON public.matches;
    CREATE POLICY "Allow all for matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 7. Setup Storage Bucket for Team Logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy to allow public upload and read for team logos
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access for team-logos" ON storage.objects;
    CREATE POLICY "Public Access for team-logos" ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');

    DROP POLICY IF EXISTS "Allow Upload for team-logos" ON storage.objects;
    CREATE POLICY "Allow Upload for team-logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team-logos');

    DROP POLICY IF EXISTS "Allow Update for team-logos" ON storage.objects;
    CREATE POLICY "Allow Update for team-logos" ON storage.objects FOR UPDATE USING (bucket_id = 'team-logos');

    DROP POLICY IF EXISTS "Allow Delete for team-logos" ON storage.objects;
    CREATE POLICY "Allow Delete for team-logos" ON storage.objects FOR DELETE USING (bucket_id = 'team-logos');
END $$;
