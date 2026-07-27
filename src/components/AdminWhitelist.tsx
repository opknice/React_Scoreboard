import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  getFirebaseAuth,
  loginWithGoogle,
  logoutUser,
  isSuperAdmin,
  SUPER_ADMIN_EMAILS,
  fetchAllUserPermissions,
  setUserAccessStatus,
  type UserAccessRecord
} from '../config/firebaseAuth';

export default function AdminWhitelist() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userRecords, setUserRecords] = useState<UserAccessRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'allowed' | 'pending' | 'denied'>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load all user records from Firebase Realtime Database
  const loadUserRecords = useCallback(async () => {
    setLoadingData(true);
    try {
      const records = await fetchAllUserPermissions();
      setUserRecords(records);
    } catch (err: any) {
      console.error('Error fetching user permissions:', err);
      const detail = err?.message || 'Permission denied';
      setMessage({
        text: `ไม่สามารถโหลดข้อมูลสิทธิ์จาก Firebase ได้: ${detail}`,
        type: 'error',
      });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser && isSuperAdmin(currentUser.email)) {
          loadUserRecords();
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('Auth Error:', err);
      setAuthLoading(false);
    }
  }, [loadUserRecords]);

  // Handle 1-click status change (Allow / Deny / Pending)
  const handleStatusChange = async (targetEmail: string, newStatus: 'allowed' | 'denied' | 'pending') => {
    if (SUPER_ADMIN_EMAILS.includes(targetEmail.toLowerCase())) {
      setMessage({ text: 'ไม่สามารถเปลี่ยนสิทธิ์ของ Super Admin ได้', type: 'error' });
      return;
    }

    setLoadingData(true);
    try {
      const updatedList = await setUserAccessStatus(targetEmail, newStatus);
      setUserRecords(updatedList);
      const actionLabel = newStatus === 'allowed' ? 'อนุญาต' : newStatus === 'denied' ? 'ระงับ/บล็อก' : 'ตั้งเป็นรออนุมัติ';
      setMessage({ text: `เปลี่ยนสิทธิ์สำหรับ ${targetEmail} เป็น "${actionLabel}" เรียบร้อยแล้ว!`, type: 'success' });
    } catch (err: any) {
      console.error('Error changing status:', err);
      setMessage({ text: 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์บน Firebase', type: 'error' });
    } finally {
      setLoadingData(false);
    }
  };

  // Pre-add email manually if needed
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = newEmail.trim().toLowerCase();
    if (!target) return;

    if (!target.includes('@')) {
      setMessage({ text: 'กรุณากรอกรูปแบบอีเมลให้ถูกต้อง', type: 'error' });
      return;
    }

    setLoadingData(true);
    try {
      const updatedList = await setUserAccessStatus(target, 'allowed');
      setUserRecords(updatedList);
      setNewEmail('');
      setMessage({ text: `เพิ่มและอนุญาตสิทธิ์อีเมล ${target} เรียบร้อยแล้ว!`, type: 'success' });
    } catch (err: any) {
      console.error('Error adding email:', err);
      setMessage({ text: 'เกิดข้อผิดพลาดในการบันทึกไปยัง Firebase Database', type: 'error' });
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login Error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (err) {
      console.error('Logout Error:', err);
    }
  };

  const filteredRecords = userRecords.filter((rec) => {
    const matchesSearch =
      rec.email.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      (rec.displayName && rec.displayName.toLowerCase().includes(searchTerm.trim().toLowerCase()));
    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={{ color: '#cbd5e1', fontSize: '16px' }}>กำลังตรวจสอบสิทธิ์ Super Admin...</div>
      </div>
    );
  }

  // If not logged in OR not Super Admin (thanakrit_kas@hotmail.com)
  if (!user || !isSuperAdmin(user.email)) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, maxWidth: '480px', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div style={{ ...styles.badge, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            🔒
          </div>
          <h2 style={{ color: '#f8fafc', fontSize: '22px', margin: '0 0 12px 0' }}>
            เฉพาะ Super Admin เท่านั้น
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            หน้านี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบสูงสุด (<strong>thanakrit_kas@hotmail.com</strong>) เท่านั้น เพื่อใช้ในการอนุมัติสิทธิ์ (Allow / Deny) ผู้ใช้งาน
          </p>

          <div style={styles.userStatusBox}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>สถานะการเข้าสู่ระบบปัจจุบัน:</div>
            <div style={{ fontWeight: 600, color: user ? '#f87171' : '#cbd5e1', fontSize: '15px', marginTop: '4px' }}>
              {user ? `บัญชี: ${user.email} (ไม่มีสิทธิ์เข้าถึง)` : 'ยังไม่ได้ลงชื่อเข้าใช้'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            {user ? (
              <button onClick={handleLogout} style={styles.primaryBtn}>
                🔄 ลงชื่อเข้าใช้ด้วยบัญชี Super Admin ({SUPER_ADMIN_EMAILS[0]})
              </button>
            ) : (
              <button onClick={handleLogin} style={styles.primaryBtn}>
                🔑 ลงชื่อเข้าใช้ด้วย Google (Super Admin)
              </button>
            )}

            <button onClick={() => navigate('/')} style={styles.secondaryBtn}>
              🏠 กลับไปหน้าหลัก (Scoreboard Controller)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = userRecords.filter((r) => r.status === 'pending').length;
  const allowedCount = userRecords.filter((r) => r.status === 'allowed').length;

  // Super Admin Logged In Screen
  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '780px', padding: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: '#f8fafc', fontWeight: 700 }}>
              🛡️ จัดการอนุมัติสิทธิ์ผู้ใช้งาน (Access Control)
            </h1>
            <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '4px' }}>
              Super Admin: <strong>{user.email}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/')} style={styles.secondaryBtn}>
            🏠 ไปหน้า Controller
          </button>
        </div>

        {/* Feedback Message Alert */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              backgroundColor:
                message.type === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
              color:
                message.type === 'success'
                  ? '#4ade80'
                  : message.type === 'error'
                  ? '#f87171'
                  : '#60a5fa',
              border: `1px solid ${
                message.type === 'success'
                  ? 'rgba(34, 197, 94, 0.3)'
                  : message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(59, 130, 246, 0.3)'
              }`,
            }}
          >
            {message.text}

            {message.type === 'error' && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#fca5a5', borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '10px' }}>
                💡 <strong>วิธีแก้ไขสิทธิ์ Realtime Database:</strong>
                <ol style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: '1.6' }}>
                  <li>เข้าสู่ <strong>Firebase Console</strong> ➔ โปรเจกต์ <strong>authen-obs-scoreboard</strong></li>
                  <li>ไปที่เมนู <strong>Build</strong> ➔ <strong>Realtime Database</strong> (กด <em>Create Database</em> หากยังไม่ได้สร้าง)</li>
                  <li>เลือกแท็บ <strong>Rules</strong> แล้วแก้ไขโค้ดเป็น:
                    <pre style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '6px', margin: '6px 0', fontSize: '12px', color: '#38bdf8' }}>
                      {`{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`}
                    </pre>
                  </li>
                  <li>กดปุ่ม <strong>Publish</strong> แล้วกลับมากดปุ่ม <strong>"🔄 รีเฟรชข้อมูลจาก Firebase"</strong></li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Stats Badges */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#60a5fa' }}>{userRecords.length}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>ผู้ใช้ทั้งหมดในระบบ</div>
          </div>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>{allowedCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>ได้รับอนุมัติ (Allowed)</div>
          </div>
          <div style={{ flex: 1, minWidth: '140px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#facc15' }}>{pendingCount}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>รออนุมัติ (Pending)</div>
          </div>
        </div>

        {/* Add Email Pre-entry Form */}
        <form onSubmit={handleAddEmail} style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
            ➕ ล่วงหน้า: เพิ่มและอนุมัติสิทธิ์อีเมลทันที (ไม่ต้องรอผู้ใช้ล็อกอิน):
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="เช่น member@gmail.com"
              style={styles.input}
            />
            <button type="submit" disabled={loadingData} style={styles.saveBtn}>
              {loadingData ? 'กำลังบันทึก...' : 'เพิ่มและอนุมัติ'}
            </button>
          </div>
        </form>

        {/* Filter / Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{ ...styles.filterTab, backgroundColor: statusFilter === 'all' ? '#2563eb' : '#1e293b' }}
            >
              ทั้งหมด ({userRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              style={{ ...styles.filterTab, backgroundColor: statusFilter === 'pending' ? '#eab308' : '#1e293b', color: statusFilter === 'pending' ? '#000' : '#cbd5e1' }}
            >
              ⏳ รออนุมัติ ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('allowed')}
              style={{ ...styles.filterTab, backgroundColor: statusFilter === 'allowed' ? '#16a34a' : '#1e293b' }}
            >
              ✅ อนุมัติแล้ว ({allowedCount})
            </button>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 ค้นหาชื่อ/อีเมล..."
            style={{ ...styles.input, maxWidth: '200px', padding: '8px 12px', fontSize: '13px' }}
          />
        </div>

        {/* User Permission Management List */}
        <div style={styles.tableContainer}>
          {filteredRecords.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              {loadingData ? 'กำลังดึงข้อมูลจาก Firebase...' : 'ยังไม่มีประวัติการเข้าใช้งานหรืออีเมลในระบบ'}
            </div>
          ) : (
            filteredRecords.map((rec) => {
              const isSuper = SUPER_ADMIN_EMAILS.includes(rec.email.toLowerCase());
              return (
                <div key={rec.email} style={styles.tableRow}>
                  {/* User Profile Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                    {rec.photoURL ? (
                      <img src={rec.photoURL} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#cbd5e1' }}>
                        {rec.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>
                          {rec.displayName || rec.email.split('@')[0]}
                        </span>
                        {isSuper && (
                          <span style={{ fontSize: '10px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                            Super Admin
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{rec.email}</div>
                      {rec.lastLogin && (
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          ล็อกอินล่าสุด: {new Date(rec.lastLogin).toLocaleString('th-TH')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div style={{ marginRight: '16px' }}>
                    {rec.status === 'allowed' ? (
                      <span style={{ fontSize: '12px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        ✅ Allowed
                      </span>
                    ) : rec.status === 'denied' ? (
                      <span style={{ fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        🚫 Denied
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        ⏳ Pending
                      </span>
                    )}
                  </div>

                  {/* 1-Click Action Buttons */}
                  {!isSuper ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {rec.status !== 'allowed' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(rec.email, 'allowed')}
                          disabled={loadingData}
                          style={styles.allowBtn}
                          title="อนุมัติให้เข้าใช้งาน"
                        >
                          ✅ Allow
                        </button>
                      )}
                      {rec.status !== 'denied' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(rec.email, 'denied')}
                          disabled={loadingData}
                          style={styles.denyBtn}
                          title="ไม่อนุญาต/บล็อกการเข้าใช้งาน"
                        >
                          🚫 Deny
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>สิทธิ์ถาวร</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Refresh & Logout Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button onClick={loadUserRecords} style={styles.secondaryBtn}>
            🔄 รีเฟรชข้อมูลจาก Firebase
          </button>
          <button onClick={handleLogout} style={styles.dangerBtn}>
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  badge: {
    width: '56px',
    height: '56px',
    margin: '0 auto 16px auto',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  userStatusBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'left',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
  },
  secondaryBtn: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  filterTab: {
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  allowBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  denyBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableContainer: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    maxHeight: '380px',
    overflowY: 'auto',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
    gap: '10px',
  },
};
