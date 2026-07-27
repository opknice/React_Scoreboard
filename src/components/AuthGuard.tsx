import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirebaseAuth,
  loginWithGoogle,
  logoutUser,
  verifyUserWhitelist,
  getEnvFirebaseConfig,
  recordUserLoginAttempt
} from '../config/firebaseAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [whitelistReason, setWhitelistReason] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Settings inputs for fallback configuration
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => {
    return localStorage.getItem('firebase_auth_api_key') || getEnvFirebaseConfig().apiKey || '';
  });
  const [whitelistInput, setWhitelistInput] = useState<string>(() => {
    return localStorage.getItem('local_allowed_emails') || '';
  });

  const checkUserAccess = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      setIsAllowed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setUser(currentUser);

    // Automatically record / update user login profile & timestamp in Realtime DB
    try {
      await recordUserLoginAttempt(currentUser);
    } catch (err) {
      console.warn('[AuthGuard] Auto record login attempt failed:', err);
    }

    const result = await verifyUserWhitelist(currentUser.email);
    setIsAllowed(result.isAllowed);
    setWhitelistReason(result.reason || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        checkUserAccess(currentUser);
      }, (error) => {
        console.error('Auth state change error:', error);
        setAuthError(error.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.warn('Firebase Auth Initialization Warning:', err);
      setLoading(false);
    }
  }, [checkUserAccess]);

  const handleLogin = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const loggedUser = await loginWithGoogle();
      await checkUserAccess(loggedUser);
    } catch (err: any) {
      console.error('Login Failed:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setIsAllowed(false);
    } catch (err) {
      console.error('Logout Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (whitelistInput.trim()) {
      localStorage.setItem('local_allowed_emails', whitelistInput.trim());
    } else {
      localStorage.removeItem('local_allowed_emails');
    }
    if (apiKeyInput.trim()) {
      const currentConfig = getEnvFirebaseConfig();
      currentConfig.apiKey = apiKeyInput.trim();
      localStorage.setItem('firebase_auth_config', JSON.stringify(currentConfig));
    }
    setShowConfigModal(false);
    if (user) {
      checkUserAccess(user);
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

        {/* Config Modal */}
        {showConfigModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc' }}>⚙️ การตั้งค่าระบบยืนยันตัวตน</h3>
              <form onSubmit={handleSaveSettings}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>
                    รายชื่ออีเมลอนุญาต (Local Whitelist - คั่นด้วยจุลภาค ,):
                  </label>
                  <textarea
                    rows={3}
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    placeholder="example@gmail.com, admin@gmail.com"
                    style={styles.textarea}
                  />
                  <small style={{ color: '#94a3b8' }}>
                    * สามารถตั้งค่า VITE_ALLOWED_EMAILS ในไฟล์ .env ได้เช่นกัน
                  </small>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.label}>Firebase API Key (ถ้าไม่ได้ตั้งใน .env):</label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    style={styles.input}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    style={styles.cancelBtn}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" style={styles.saveBtn}>
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Access Denied Screen (Logged in but not whitelisted)
  if (!isAllowed) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div style={{ ...styles.logoBadge, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🚫
          </div>
          <h2 style={{ ...styles.title, fontSize: '22px', color: '#f8fafc' }}>
            ไม่มีสิทธิ์เข้าใช้งานระบบ
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
            บัญชีของคุณยังไม่ได้อยู่ในรายชื่อผู้ได้รับอนุญาต (Whitelist)
          </p>

          <div style={styles.userInfoBox}>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                style={styles.userAvatar}
              />
            )}
            <div>
              <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{user.displayName || 'Google User'}</div>
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

  // Logged In & Whitelisted: Render Protected Content
  return <>{children}</>;
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: '90%',
    maxWidth: '450px',
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
};
