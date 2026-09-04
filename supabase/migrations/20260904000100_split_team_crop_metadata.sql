-- Separate logo crop settings by presentation target.
-- The legacy crop_metadata column is intentionally left untouched so this
-- migration does not destroy existing data; the application no longer reads it.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS overlay_crop_metadata jsonb,
  ADD COLUMN IF NOT EXISTS logo_browser_crop_metadata jsonb;

COMMENT ON COLUMN public.teams.overlay_crop_metadata IS
  'Crop settings for Overlay/OBS scoreboard views.';

COMMENT ON COLUMN public.teams.logo_browser_crop_metadata IS
  'Crop settings for Logo Browser Source and goal animations.';
