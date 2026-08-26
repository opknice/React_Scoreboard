import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseAuthApp, encodeEmailKey } from '../config/firebaseAuth';
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
  const [userEmail, setUserEmail] = useState<string>(() => {
    try {
      const currentUser = getFirebaseAuth().currentUser;
      return currentUser?.email || localStorage.getItem('last_user_email') || '';
    } catch {
      return '';
    }
  });

  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to auth state changes to ensure userEmail stays synced
  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser?.email) {
          setUserEmail(currentUser.email);
          localStorage.setItem('last_user_email', currentUser.email);
        } else {
          setUserEmail('');
        }
      });
      return () => unsubscribe();
    } catch {
      // Fallback if auth app isn't ready yet
      return undefined;
    }
  }, []);

  // Unlimited if super-admin or whitelist
  const isUnlimited = accessDecision?.accessType === 'super-admin' || accessDecision?.accessType === 'whitelist';

  // Load upload count from Firebase / LocalStorage
  const loadQuota = useCallback(async () => {
    if (!userEmail) {
      const localVal = parseInt(localStorage.getItem('guest_upload_count') || '0', 10);
      setUploadedCount(isNaN(localVal) ? 0 : localVal);
      setLoading(false);
      return;
    }

    try {
      const key = encodeEmailKey(userEmail);
      const app = getFirebaseAuthApp();
      const db = getDatabase(app);
      const userRef = ref(db, `user_permissions/${key}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const val = snapshot.val();
        const count = typeof val.uploadedImageCount === 'number' ? val.uploadedImageCount : 0;
        setUploadedCount(count);
        localStorage.setItem(`upload_count_${key}`, String(count));
      } else {
        const localVal = parseInt(localStorage.getItem(`upload_count_${key}`) || '0', 10);
        setUploadedCount(isNaN(localVal) ? 0 : localVal);
      }
    } catch (err) {
      console.warn('[useImageUploadQuota] Failed to fetch upload count from Firebase:', err);
      const key = encodeEmailKey(userEmail);
      const localVal = parseInt(localStorage.getItem(`upload_count_${key}`) || '0', 10);
      setUploadedCount(isNaN(localVal) ? 0 : localVal);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const incrementUploadCount = useCallback(async (): Promise<number> => {
    const nextCount = uploadedCount + 1;
    setUploadedCount(nextCount);

    if (userEmail) {
      const key = encodeEmailKey(userEmail);
      localStorage.setItem(`upload_count_${key}`, String(nextCount));
      try {
        const app = getFirebaseAuthApp();
        const db = getDatabase(app);
        const userRef = ref(db, `user_permissions/${key}`);
        await update(userRef, { uploadedImageCount: nextCount });
      } catch (err) {
        console.warn('[useImageUploadQuota] Failed to update count in Firebase:', err);
      }
    } else {
      localStorage.setItem('guest_upload_count', String(nextCount));
    }

    return nextCount;
  }, [uploadedCount, userEmail]);

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
