-- Player photos use a separate Cloudinary quota. Existing logo/image uploads
-- continue using uploaded_image_count and the 10-image limit.

ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS uploaded_player_image_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_uploaded_player_image_count_check,
  ADD CONSTRAINT user_permissions_uploaded_player_image_count_check
    CHECK (uploaded_player_image_count >= 0);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS image_public_id text;

CREATE OR REPLACE FUNCTION public.can_upload_player_image()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_record public.user_permissions;
  v_now_ms bigint := (extract(epoch FROM now()) * 1000)::bigint;
BEGIN
  IF auth.uid() IS NULL OR v_email = '' THEN
    RETURN false;
  END IF;

  IF public.is_super_admin_email(v_email) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_record
  FROM public.user_permissions
  WHERE lower(email) = v_email;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_record.status = 'allowed' THEN
    RETURN true;
  END IF;

  RETURN v_record.status = 'pending'
    AND v_record.trial_started_at IS NOT NULL
    AND v_record.trial_started_at + (7 * 24 * 60 * 60 * 1000) > v_now_ms
    AND v_record.uploaded_player_image_count < 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_uploaded_player_image_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_record public.user_permissions;
  v_next integer;
  v_now_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF auth.uid() IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_record
  FROM public.user_permissions
  WHERE lower(email) = v_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user permission record not found';
  END IF;

  IF public.is_super_admin_email(v_email) OR v_record.status = 'allowed' THEN
    RETURN -1;
  END IF;

  IF v_record.status <> 'pending'
     OR v_record.trial_started_at IS NULL
     OR v_record.trial_started_at + (7 * 24 * 60 * 60 * 1000) <= v_now_ms THEN
    RAISE EXCEPTION 'upload access denied';
  END IF;

  IF v_record.uploaded_player_image_count >= 20 THEN
    RAISE EXCEPTION 'player image upload quota exceeded';
  END IF;

  UPDATE public.user_permissions
  SET uploaded_player_image_count = uploaded_player_image_count + 1,
      updated_at = now()
  WHERE id = v_record.id
  RETURNING uploaded_player_image_count INTO v_next;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_player_image() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_player_image() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_player_image() TO service_role;

REVOKE ALL ON FUNCTION public.increment_uploaded_player_image_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_player_image_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_player_image_count() TO service_role;
