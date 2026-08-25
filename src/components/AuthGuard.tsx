import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import {
  loginWithGoogleSupabase,
  logoutSupabaseUser,
  subscribeToSupabaseAuth,
  subscribeToSupabasePermissionChanges,
  getSupabaseUserDisplayName,
  getSupabaseUserPhotoUrl,
} from '../config/supabaseAuth';
import {
  verifySupabaseUserAccess,
  recordSupabaseLoginAttempt,
  FREE_TRIAL_DAYS,
  type AccessDecision,
} from '../config/supabaseAccess';
import { AuthAccessProvider } from '../context/AuthAccessProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

interface AccessCheckOptions {
  blockUi?: boolean;
  recordLogin?: boolean;
}

const ACCESS_CHECK_TTL_MS = 5 * 60 * 1000;
const FALLBACK_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [whitelistReason, setWhitelistReason] = useState<string | null>(null);
  const [accessDecision, setAccessDecision] = useState<AccessDecision | null>(null);
  const accessCheckSequenceRef = useRef(0);
  const accessCheckUserIdRef = useRef<string | null>(null);
  const lastAccessCheckRef = useRef<{ userId: string; checkedAt: number } | null>(null);

  const checkUserAccess = useCallback(async (
    currentUser: User | null,
    options: AccessCheckOptions = {},
  ) => {
    const { blockUi = true, recordLogin = false } = options;
    const sequence = ++accessCheckSequenceRef.current;

    if (!currentUser) {
      accessCheckUserIdRef.current = null;
      setUser(null);
      setIsAllowed(false);
      setAccessDecision(null);
      setLoading(false);
      lastAccessCheckRef.current = null;
      return;
    }

    accessCheckUserIdRef.current = currentUser.id;
    setUser(currentUser);
    setAuthError(null);
    if (blockUi) setLoading(true);

    if (recordLogin) {
      // Update the Supabase access record created by the auth.users trigger.
      try {
        await recordSupabaseLoginAttempt();
      } catch (err: unknown) {
        console.warn('[AuthGuard] Auto record login attempt failed:', err);
      }
    }

    try {
      const result = await verifySupabaseUserAccess(currentUser);
      if (sequence !== accessCheckSequenceRef.current) return;

      setIsAllowed(result.isAllowed);
      setWhitelistReason(result.reason || null);
      setAccessDecision(result);
      lastAccessCheckRef.current = { userId: currentUser.id, checkedAt: Date.now() };
    } catch (err: unknown) {
      if (sequence !== accessCheckSequenceRef.current) return;

      const message = err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบสิทธิ์ได้';
      console.error('[AuthGuard] Supabase access check failed:', err);
      setAuthError(message);
      setIsAllowed(false);
      setWhitelistReason(message);
      setAccessDecision(null);
    } finally {
      if (sequence === accessCheckSequenceRef.current) accessCheckUserIdRef.current = null;
      if (sequence === accessCheckSequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    try {
      const handleAuthChange = (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;

        if (event === 'TOKEN_REFRESHED') {
          // Token renewal is handled internally by Supabase. The current user
          // and access decision remain valid, so the protected app stays mounted.
          return;
        }

        if (event === 'SIGNED_OUT') {
          void checkUserAccess(null, { blockUi: false });
          return;
        }

        if (event === 'INITIAL_SESSION') {
          void checkUserAccess(currentUser, { blockUi: true, recordLogin: Boolean(currentUser) });
          return;
        }

        if (event === 'SIGNED_IN') {
          if (currentUser && accessCheckUserIdRef.current === currentUser.id) return;

          const lastCheck = lastAccessCheckRef.current;
          const recentlyChecked = Boolean(
            currentUser
            && lastCheck?.userId === currentUser.id
            && Date.now() - lastCheck.checkedAt < ACCESS_CHECK_TTL_MS,
          );
          const isNewUser = Boolean(currentUser && (!lastCheck || lastCheck.userId !== currentUser.id));

          setUser(currentUser);
          if (!recentlyChecked) {
            void checkUserAccess(currentUser, {
              blockUi: isNewUser,
              recordLogin: isNewUser,
            });
          }
          return;
        }

        if (event === 'USER_UPDATED') {
          void checkUserAccess(currentUser, { blockUi: false });
        }
      };

      const unsubscribe = subscribeToSupabaseAuth((event, session) => {
        if (!mounted) return;

        // Defer work outside Supabase's auth callback to avoid blocking its
        // internal lock while access RPCs are running.
        window.setTimeout(() => {
          if (mounted) handleAuthChange(event, session);
        }, 0);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (err: unknown) {
      console.warn('Supabase Auth Initialization Warning:', err);
      setLoading(false);
    }
  }, [checkUserAccess]);

  useEffect(() => {
    if (!user) return undefined;

    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;

      const lastCheck = lastAccessCheckRef.current;
      const isStale = !lastCheck || Date.now() - lastCheck.checkedAt >= ACCESS_CHECK_TTL_MS;
      const isAlreadyChecking = accessCheckUserIdRef.current === user.id;
      if (!isStale || isAlreadyChecking) return;

      void checkUserAccess(user, { blockUi: false, recordLogin: false });
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    const fallbackCheckId = window.setInterval(handleResume, FALLBACK_CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.clearInterval(fallbackCheckId);
    };
  }, [checkUserAccess, user]);

  useEffect(() => {
    if (!user || !accessDecision) return undefined;

    return subscribeToSupabasePermissionChanges(
      user.id,
      () => {
        void checkUserAccess(user, { blockUi: false, recordLogin: false });
      },
      (error: unknown) => {
        console.warn('[AuthGuard] Permission Realtime warning:', error);
      },
    );
  }, [accessDecision, checkUserAccess, user]);

  // Re-check exactly when the trial expires so the protected page is closed
  // without requiring a refresh or another login.
  useEffect(() => {
    if (!user || accessDecision?.accessType !== 'trial' || !accessDecision.trialExpiresAt) return undefined;

    const delay = Math.max(1000, accessDecision.trialExpiresAt - Date.now() + 100);
    const timeoutId = window.setTimeout(() => {
      void checkUserAccess(user);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [accessDecision, checkUserAccess, user]);

  const handleLogin = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      await loginWithGoogleSupabase();
    } catch (err: unknown) {
      console.error('Login Failed:', err);
      setAuthError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutSupabaseUser();
      setUser(null);
      setIsAllowed(false);
      setAccessDecision(null);
    } catch (err) {
      console.error('Logout Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '16px', color: '#cbd5e1', fontSize: '15px' }}>
            กำลังตรวจสอบสิทธิ์การใช้งาน...
          </p>
        </div>
      </div>
    );
  }

  // Not Logged In Screen
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoBadge}>⚽</div>
          <h1 style={styles.title}>Scoreboard Controller</h1>
          <p style={styles.subtitle}>กรุณาลงชื่อเข้าใช้งานด้วย Google (Gmail)</p>

          {authError && (
            <div style={styles.errorBox}>
              ⚠️ {authError}
            </div>
          )}

          <button onClick={handleLogin} style={styles.googleBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '12px' }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

      </div>
    );
  }

  // Access Denied Screen (Logged in but not whitelisted)
  if (!isAllowed) {
    const trialExpired = accessDecision?.accessType === 'trial-expired';
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div style={{ ...styles.logoBadge, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🚫
          </div>
          <h2 style={{ ...styles.title, fontSize: '22px', color: '#f8fafc' }}>
            {trialExpired ? `หมดช่วงทดลองใช้งานฟรี ${FREE_TRIAL_DAYS} วัน` : 'ไม่มีสิทธิ์เข้าใช้งานระบบ'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
            {trialExpired
              ? 'กรุณาติดต่อ Super Admin เพื่อขออนุมัติสิทธิ์ใช้งานต่อ'
              : 'บัญชีของคุณยังไม่ได้อยู่ในรายชื่อผู้ได้รับอนุญาต (Whitelist)'}
          </p>

          <div style={styles.userInfoBox}>
            {getSupabaseUserPhotoUrl(user) && (
              <img
                src={getSupabaseUserPhotoUrl(user)}
                alt={getSupabaseUserDisplayName(user)}
                style={styles.userAvatar}
              />
            )}
            <div>
              <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{getSupabaseUserDisplayName(user)}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{user.email}</div>
            </div>
          </div>

          {whitelistReason && (
            <div style={styles.deniedReason}>
              {whitelistReason}
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              🔄 ลงชื่อเข้าใช้ด้วยบัญชีอื่น (Switch Account)
            </button>
          </div>
        </div>

      </div>
    );
  }

  // Logged in & allowed: Render protected content and show trial status.
  return (
    <AuthAccessProvider value={accessDecision} user={user}>
      {accessDecision?.accessType === 'trial' && (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 9000,
            maxWidth: 'min(360px, calc(100vw - 24px))',
            padding: '9px 13px',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            borderRadius: '10px',
            color: '#bae6fd',
            background: 'rgba(8, 47, 73, 0.94)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
            fontSize: '12px',
          }}
        >
          🎁 ทดลองใช้งานฟรี เหลือประมาณ {accessDecision.trialDaysRemaining || 1} วัน
        </div>
      )}
      {children}
    </AuthAccessProvider>
  );
}

// Inline Styles for Modern Glassmorphic Dark UI
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '36px 28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
  },
  logoBadge: {
    width: '64px',
    height: '64px',
    margin: '0 auto 16px auto',
    borderRadius: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '0 0 28px 0',
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 20px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  userInfoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'left',
    marginBottom: '16px',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
    textAlign: 'left',
  },
  deniedReason: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '12px',
    marginTop: '10px',
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
