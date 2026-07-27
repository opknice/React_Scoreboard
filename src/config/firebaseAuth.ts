import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import { getDatabase, ref, get, set, update } from 'firebase/database';

export interface UserAccessRecord {
  email: string;
  displayName?: string;
  photoURL?: string;
  status: 'allowed' | 'denied' | 'pending';
  lastLogin: string;
}

// Default Firebase config reading from environment variables
export const getEnvFirebaseConfig = () => {
  const saved = localStorage.getItem('firebase_auth_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA5MoX9tsXS7BYTNE3pzV_Mzpxuis9xEfI',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'authen-obs-scoreboard.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'authen-obs-scoreboard',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'authen-obs-scoreboard.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '462185565780',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:462185565780:web:af2268a912ee9e4e25a7c1',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://authen-obs-scoreboard-default-rtdb.firebaseio.com',
  };
};

const AUTH_APP_NAME = '[DEFAULT_AUTH_APP]';

export const getFirebaseAuthApp = (customConfig?: Record<string, string>): FirebaseApp => {
  const config = customConfig || getEnvFirebaseConfig();
  if (getApps().some((app) => app.name === AUTH_APP_NAME)) {
    return getApp(AUTH_APP_NAME);
  }
  if (getApps().length > 0 && !customConfig && !config.apiKey) {
    return getApps()[0];
  }
  return initializeApp(config, AUTH_APP_NAME);
};

export const getFirebaseAuth = (customConfig?: Record<string, string>): Auth => {
  const app = getFirebaseAuthApp(customConfig);
  return getAuth(app);
};

// Google Sign-In Helper
export const loginWithGoogle = async (customConfig?: Record<string, string>): Promise<User> => {
  const auth = getFirebaseAuth(customConfig);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

// Logout Helper
export const logoutUser = async (customConfig?: Record<string, string>): Promise<void> => {
  const auth = getFirebaseAuth(customConfig);
  await signOut(auth);
};

// Default Whitelist reading from environment variables
export const getEnvAllowedEmails = (): string[] => {
  const envEmails = import.meta.env.VITE_ALLOWED_EMAILS || '';
  if (!envEmails.trim()) return [];
  return envEmails
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
};

export const SUPER_ADMIN_EMAILS = ['thanakrit_kas@hotmail.com'];

export const isSuperAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const encodeEmailKey = (email: string): string => {
  return email.trim().toLowerCase().replace(/\./g, ',');
};

// Record/Update User Profile and Login Timestamp on Firebase Realtime DB
export const recordUserLoginAttempt = async (
  user: User,
  customConfig?: Record<string, string>
): Promise<UserAccessRecord> => {
  if (!user || !user.email) {
    throw new Error('No user or email found');
  }
  const cleanEmail = user.email.trim().toLowerCase();
  const key = encodeEmailKey(cleanEmail);

  const app = getFirebaseAuthApp(customConfig);
  const db = getDatabase(app);
  const userRef = ref(db, `user_permissions/${key}`);

  const snapshot = await get(userRef);
  const now = new Date().toISOString();

  if (snapshot.exists()) {
    const existing = snapshot.val() as UserAccessRecord;
    const updatedRecord: UserAccessRecord = {
      ...existing,
      displayName: user.displayName || existing.displayName || '',
      photoURL: user.photoURL || existing.photoURL || '',
      lastLogin: now,
    };
    await update(userRef, {
      displayName: updatedRecord.displayName,
      photoURL: updatedRecord.photoURL,
      lastLogin: updatedRecord.lastLogin,
    });
    return updatedRecord;
  } else {
    const initialStatus: 'allowed' | 'pending' =
      SUPER_ADMIN_EMAILS.includes(cleanEmail) || getEnvAllowedEmails().includes(cleanEmail)
        ? 'allowed'
        : 'pending';

    const newRecord: UserAccessRecord = {
      email: cleanEmail,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      status: initialStatus,
      lastLogin: now,
    };
    await set(userRef, newRecord);

    if (initialStatus === 'allowed') {
      try {
        await addFirebaseWhitelistEmail(cleanEmail, customConfig);
      } catch {
        // ignore sync error
      }
    }
    return newRecord;
  }
};

// Fetch all recorded users with their permission status
export const fetchAllUserPermissions = async (
  customConfig?: Record<string, string>
): Promise<UserAccessRecord[]> => {
  try {
    const app = getFirebaseAuthApp(customConfig);
    const db = getDatabase(app);
    const permissionsRef = ref(db, 'user_permissions');
    const snapshot = await get(permissionsRef);
    if (!snapshot.exists()) return [];

    const val = snapshot.val();
    if (typeof val === 'object' && val !== null) {
      return Object.values(val) as UserAccessRecord[];
    }
    return [];
  } catch (err) {
    console.warn('[UserPermissions] Fetch error:', err);
    return [];
  }
};

// 1-Click Action for Super Admin to Allow / Deny / Set Pending for any user
export const setUserAccessStatus = async (
  targetEmail: string,
  newStatus: 'allowed' | 'denied' | 'pending',
  customConfig?: Record<string, string>
): Promise<UserAccessRecord[]> => {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const key = encodeEmailKey(cleanEmail);
  const app = getFirebaseAuthApp(customConfig);
  const db = getDatabase(app);
  const userRef = ref(db, `user_permissions/${key}`);

  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    await update(userRef, { status: newStatus });
  } else {
    await set(userRef, {
      email: cleanEmail,
      displayName: '',
      photoURL: '',
      status: newStatus,
      lastLogin: new Date().toISOString(),
    });
  }

  // Synchronize legacy /whitelist array
  if (newStatus === 'allowed') {
    await addFirebaseWhitelistEmail(cleanEmail, customConfig);
  } else {
    await removeFirebaseWhitelistEmail(cleanEmail, customConfig);
  }

  return await fetchAllUserPermissions(customConfig);
};

// Whitelist Verification Helper
export const verifyUserWhitelist = async (
  email: string | null | undefined,
  customAllowedEmails?: string[],
  customConfig?: Record<string, string>
): Promise<{ isAllowed: boolean; reason?: string }> => {
  if (!email) {
    return { isAllowed: false, reason: 'No email address found for user.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 0. Super Admin bypass: Always allowed
  if (SUPER_ADMIN_EMAILS.includes(cleanEmail)) {
    return { isAllowed: true };
  }

  // 1. Check user_permissions node in Firebase Realtime Database
  try {
    const key = encodeEmailKey(cleanEmail);
    const app = getFirebaseAuthApp(customConfig);
    const db = getDatabase(app);
    const userRef = ref(db, `user_permissions/${key}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const record = snapshot.val() as UserAccessRecord;
      if (record.status === 'allowed') {
        return { isAllowed: true };
      }
      if (record.status === 'denied') {
        return { isAllowed: false, reason: 'บัญชีนี้ถูกปฏิเสธ/ระงับการเข้าใช้งานโดย Super Admin' };
      }
      if (record.status === 'pending') {
        return { isAllowed: false, reason: 'บัญชีของคุณกำลังรอการอนุมัติสิทธิ์จาก Super Admin (thanakrit_kas@hotmail.com)' };
      }
    }
  } catch (err) {
    console.warn('[AuthGuard] user_permissions check failed:', err);
  }

  // 2. Check local / ENV whitelist fallback
  const allowedList = customAllowedEmails && customAllowedEmails.length > 0
    ? customAllowedEmails.map((e) => e.trim().toLowerCase())
    : getEnvAllowedEmails();

  if (allowedList.length > 0 && allowedList.includes(cleanEmail)) {
    return { isAllowed: true };
  }

  // 3. Check legacy Firebase Realtime Database '/whitelist' path
  try {
    const app = getFirebaseAuthApp(customConfig);
    const db = getDatabase(app);
    const whitelistRef = ref(db, 'whitelist');
    const snapshot = await get(whitelistRef);
    if (snapshot.exists()) {
      const val = snapshot.val();
      let dbEmails: string[] = [];
      if (Array.isArray(val)) {
        dbEmails = val.map((item) => String(item).trim().toLowerCase());
      } else if (typeof val === 'object' && val !== null) {
        dbEmails = Object.values(val).map((item) => String(item).trim().toLowerCase());
      }

      if (dbEmails.includes(cleanEmail)) {
        return { isAllowed: true };
      }
    }
  } catch (err) {
    console.warn('[AuthGuard] Database whitelist check failed or skipped:', err);
  }

  // Strict Whitelist Enforcement: Default to Pending status explanation
  return {
    isAllowed: false,
    reason: `บัญชี ${cleanEmail} กำลังรอ Super Admin (thanakrit_kas@hotmail.com) อนุมัติสิทธิ์การใช้งาน`,
  };
};

// Realtime Database Whitelist CRUD Helpers
export const fetchFirebaseWhitelist = async (customConfig?: Record<string, string>): Promise<string[]> => {
  try {
    const app = getFirebaseAuthApp(customConfig);
    const db = getDatabase(app);
    const whitelistRef = ref(db, 'whitelist');
    const snapshot = await get(whitelistRef);
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    if (Array.isArray(val)) {
      return val.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    }
    if (typeof val === 'object' && val !== null) {
      return Object.values(val).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    }
    return [];
  } catch (err: any) {
    console.error('[Firebase Whitelist] Fetch error:', err);
    throw new Error(err?.message || 'Permission denied or Database not found in Firebase Realtime Database');
  }
};

export const addFirebaseWhitelistEmail = async (newEmail: string, customConfig?: Record<string, string>): Promise<string[]> => {
  const clean = newEmail.trim().toLowerCase();
  if (!clean) return await fetchFirebaseWhitelist(customConfig);

  const currentList = await fetchFirebaseWhitelist(customConfig);
  if (!currentList.includes(clean)) {
    const updated = [...currentList, clean];
    const app = getFirebaseAuthApp(customConfig);
    const db = getDatabase(app);
    await set(ref(db, 'whitelist'), updated);
    return updated;
  }
  return currentList;
};

export const removeFirebaseWhitelistEmail = async (targetEmail: string, customConfig?: Record<string, string>): Promise<string[]> => {
  const clean = targetEmail.trim().toLowerCase();
  const currentList = await fetchFirebaseWhitelist(customConfig);
  const updated = currentList.filter((e) => e !== clean);
  const app = getFirebaseAuthApp(customConfig);
  const db = getDatabase(app);
  await set(ref(db, 'whitelist'), updated);
  return updated;
};
