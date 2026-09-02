import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../config/supabaseClient';
import { incrementUploadedImageCount } from '../services/supabaseAuthService';
import { useAuthAccess } from './useAuthAccess';
import { FREE_TRIAL_IMAGE_LIMIT } from '../constants/uploadConfig';

export interface UseImageUploadQuotaResult {
  uploadedCount: number;
  remainingQuota: number | 'unlimited';
  isQuotaExceeded: boolean;
  isUnlimited: boolean;
  incrementUploadCount: () => Promise<number>;
  quotaMessage: string;
  loading: boolean;
}

export function useImageUploadQuota(): UseImageUploadQuotaResult {
  const accessDecision = useAuthAccess();
  const userEmail = accessDecision?.email || '';
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const isUnlimited = accessDecision?.accessType === 'super-admin' || accessDecision?.accessType === 'whitelist';

  useEffect(() => {
    let cancelled = false;

    const loadQuota = async () => {
      if (!userEmail) {
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
          .select('uploaded_image_count')
          .eq('email', userEmail.trim().toLowerCase())
          .maybeSingle();
        if (error) throw error;

        const count = data && typeof data.uploaded_image_count === 'number'
          ? Math.max(0, data.uploaded_image_count)
          : 0;
        if (!cancelled) setUploadedCount(count);
      } catch (error) {
        console.error('[useImageUploadQuota] Failed to fetch quota from Supabase:', error);
        // Fail closed for authenticated trial users when the quota cannot be verified.
        if (!cancelled) setUploadedCount(FREE_TRIAL_IMAGE_LIMIT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadQuota();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const incrementUploadCount = useCallback(async (): Promise<number> => {
    if (!userEmail) {
      const guestKey = 'guest_upload_count';
      const current = Number.parseInt(localStorage.getItem(guestKey) || '0', 10);
      const nextCount = Number.isFinite(current) ? current + 1 : 1;
      localStorage.setItem(guestKey, String(nextCount));
      setUploadedCount(nextCount);
      return nextCount;
    }

    const nextCount = await incrementUploadedImageCount();
    setUploadedCount(nextCount);
    return nextCount;
  }, [userEmail]);

  const remainingQuota = isUnlimited
    ? 'unlimited'
    : Math.max(0, FREE_TRIAL_IMAGE_LIMIT - uploadedCount);
  const isQuotaExceeded = !isUnlimited && typeof remainingQuota === 'number' && remainingQuota <= 0;

  let quotaMessage = '';
  if (isUnlimited) {
    quotaMessage = 'สิทธิ์การอัปโหลดรูปภาพ: ไม่จำกัด (สมาชิกเต็มรูปแบบ)';
  } else if (typeof remainingQuota === 'number' && remainingQuota > 0) {
    quotaMessage = `โควต้าการอัปโหลดรูปภาพคงเหลือ: ${remainingQuota}/${FREE_TRIAL_IMAGE_LIMIT} รูป (Free Trial)`;
  } else {
    quotaMessage = `❌ ใช้โควต้าอัปโหลดรูปภาพครบ ${FREE_TRIAL_IMAGE_LIMIT}/${FREE_TRIAL_IMAGE_LIMIT} รูปแล้ว (กรุณาสมัครสมาชิกเพื่อใช้งานไม่จำกัด)`;
  }

  return {
    uploadedCount,
    remainingQuota,
    isQuotaExceeded,
    isUnlimited,
    incrementUploadCount,
    quotaMessage,
    loading,
  };
}
