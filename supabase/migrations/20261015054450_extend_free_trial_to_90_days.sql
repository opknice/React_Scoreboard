-- Extend the free trial from 7 to 90 days at every server-side upload gate.
-- The explicit bigint cast prevents PostgreSQL integer overflow because
-- 90 days in milliseconds is greater than the signed 32-bit integer limit.

CREATE OR REPLACE FUNCTION public.can_upload_image()
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
    AND v_record.trial_started_at + (90::bigint * 24 * 60 * 60 * 1000) > v_now_ms
    AND v_record.uploaded_image_count < 10;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_image() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_image() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_image() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_image() TO service_role;

CREATE OR REPLACE FUNCTION public.increment_uploaded_image_count()
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

  IF NOT public.is_super_admin_email(v_email)
     AND v_record.status <> 'allowed'
     AND NOT (
       v_record.status = 'pending'
       AND v_record.trial_started_at IS NOT NULL
       AND v_record.trial_started_at + (90::bigint * 24 * 60 * 60 * 1000) > v_now_ms
     ) THEN
    RAISE EXCEPTION 'upload access denied';
  END IF;

  IF v_record.status = 'pending' AND v_record.uploaded_image_count >= 10 THEN
    RAISE EXCEPTION 'image upload quota exceeded';
  END IF;

  UPDATE public.user_permissions
  SET uploaded_image_count = uploaded_image_count + 1,
      updated_at = now()
  WHERE id = v_record.id
  RETURNING uploaded_image_count INTO v_next;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_uploaded_image_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_uploaded_image_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_image_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_image_count() TO service_role;

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
    AND v_record.trial_started_at + (90::bigint * 24 * 60 * 60 * 1000) > v_now_ms
    AND v_record.uploaded_player_image_count < 20;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_player_image() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_player_image() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_player_image() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_player_image() TO service_role;

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
     OR v_record.trial_started_at + (90::bigint * 24 * 60 * 60 * 1000) <= v_now_ms THEN
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

REVOKE ALL ON FUNCTION public.increment_uploaded_player_image_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_uploaded_player_image_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_player_image_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_uploaded_player_image_count() TO service_role;
