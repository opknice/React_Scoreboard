import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../config/supabaseClient';
import { useAuthAccess } from './useAuthAccess';

export const PLAYER_IMAGE_UPLOAD_LIMIT = 20;

export interface UsePlayerImageUploadQuotaResult {
  uploadedCount: number;
  remainingQuota: number | 'unlimited';
  isQuotaExceeded: boolean;
  isUnlimited: boolean;
  quotaMessage: string;
  loading: boolean;
  syncRemainingQuota: (remainingQuota: number | null) => void;
}

export function usePlayerImageUploadQuota(): UsePlayerImageUploadQuotaResult {
  const accessDecision = useAuthAccess();
  const email = accessDecision?.email?.trim().toLowerCase() || '';
  const [uploadedCount, setUploadedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isUnlimited = accessDecision?.accessType === 'super-admin' || accessDecision?.accessType === 'whitelist';

  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      if (!email || isUnlimited) {
        if (!cancelled) {
          setUploadedCount(0);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await getSupabaseClient()
          .from('user_permissions')
          .select('uploaded_player_image_count')
          .eq('email', email)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          setUploadedCount(data && typeof data.uploaded_player_image_count === 'number'
            ? Math.max(0, data.uploaded_player_image_count)
            : 0);
        }
      } catch (error: unknown) {
        console.error('[usePlayerImageUploadQuota] Failed to fetch quota:', error);
        if (!cancelled) setUploadedCount(PLAYER_IMAGE_UPLOAD_LIMIT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadCount();
    return () => { cancelled = true; };
  }, [email, isUnlimited]);

  const remainingQuota = isUnlimited ? 'unlimited' : Math.max(0, PLAYER_IMAGE_UPLOAD_LIMIT - uploadedCount);
  const isQuotaExceeded = !isUnlimited && remainingQuota === 0;
  const syncRemainingQuota = useCallback((nextRemainingQuota: number | null) => {
    if (typeof nextRemainingQuota === 'number') {
      setUploadedCount(Math.max(0, PLAYER_IMAGE_UPLOAD_LIMIT - nextRemainingQuota));
    }
  }, []);
  const quotaMessage = useMemo(() => {
    if (isUnlimited) return 'โควต้ารูปนักเตะ: ไม่จำกัด (Whitelist)';
    return `โควต้ารูปนักเตะคงเหลือ: ${remainingQuota}/${PLAYER_IMAGE_UPLOAD_LIMIT} รูป (Free Trial)`;
  }, [isUnlimited, remainingQuota]);

  return { uploadedCount, remainingQuota, isQuotaExceeded, isUnlimited, quotaMessage, loading, syncRemainingQuota };
}
