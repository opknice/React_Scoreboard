import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseCurrentUser, subscribeToSupabaseAuth } from '../config/supabaseAuth';
import { getSupabaseClient } from '../config/supabaseClient';
import { getSupabaseUserAccess } from '../config/supabaseAccess';
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = subscribeToSupabaseAuth((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    void getSupabaseCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));
    return () => unsubscribe();
  }, []);

  // Unlimited if super-admin or whitelist
  const isUnlimited = accessDecision?.accessType === 'super-admin' || accessDecision?.accessType === 'whitelist';

  const loadQuota = useCallback(async () => {
    if (!currentUser) {
      const localVal = parseInt(localStorage.getItem('guest_upload_count') || '0', 10);
      setUploadedCount(isNaN(localVal) ? 0 : localVal);
      setLoading(false);
      return;
    }

    try {
      const access = await getSupabaseUserAccess(currentUser);
      const count = access?.uploadedImageCount ?? 0;
      setUploadedCount(count);
      localStorage.setItem(`upload_count_${currentUser.id}`, String(count));
    } catch (err: unknown) {
      console.warn('[useImageUploadQuota] Failed to fetch upload count from Supabase:', err);
      const key = currentUser.id;
      const localVal = parseInt(localStorage.getItem(`upload_count_${key}`) || '0', 10);
      setUploadedCount(isNaN(localVal) ? 0 : localVal);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const incrementUploadCount = useCallback(async (): Promise<number> => {
    if (currentUser) {
      try {
        const { data, error } = await getSupabaseClient().rpc('increment_image_upload_count', { amount: 1 });
        if (error) throw error;
        const nextCount = typeof data === 'number' ? data : uploadedCount + 1;
        setUploadedCount(nextCount);
        localStorage.setItem(`upload_count_${currentUser.id}`, String(nextCount));
        return nextCount;
      } catch (err: unknown) {
        console.warn('[useImageUploadQuota] Failed to update count in Supabase:', err);
        const fallbackCount = uploadedCount + 1;
        setUploadedCount(fallbackCount);
        localStorage.setItem(`upload_count_${currentUser.id}`, String(fallbackCount));
        return fallbackCount;
      }
    }

    const nextCount = uploadedCount + 1;
    setUploadedCount(nextCount);
    localStorage.setItem('guest_upload_count', String(nextCount));
    return nextCount;
  }, [currentUser, uploadedCount]);

  const remainingQuota = isUnlimited
    ? 'unlimited'
    : Math.max(0, FREE_TRIAL_IMAGE_LIMIT - uploadedCount);

  const isQuotaExceeded = !isUnlimited && typeof remainingQuota === 'number' && remainingQuota <= 0;

  let quotaMessage = '';
  if (isUnlimited) {
    quotaMessage = 'สิทธิ์การอัปโหลดรูปภาพ: ไม่จำกัด (สมาชิกเต็มรูปแบบ)';
  } else if (typeof remainingQuota === 'number') {
    if (remainingQuota > 0) {
      quotaMessage = `โควต้าการอัปโหลดรูปภาพคงเหลือ: ${remainingQuota}/${FREE_TRIAL_IMAGE_LIMIT} รูป (Free Trial)`;
    } else {
      quotaMessage = `❌ ใช้โควต้าอัปโหลดรูปภาพครบ ${FREE_TRIAL_IMAGE_LIMIT}/${FREE_TRIAL_IMAGE_LIMIT} รูปแล้ว (กรุณาสมัครสมาชิกเพื่อใช้งานไม่จำกัด)`;
    }
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
