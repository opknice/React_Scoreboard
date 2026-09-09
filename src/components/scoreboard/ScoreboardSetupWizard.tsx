import React from 'react';
import type { League } from '../../config/supabaseClient';
import UiIcon from '../UiIcon';

export interface ScoreboardSetupWizardProps {
  isStep1Complete: boolean;
  isStep2Complete: boolean;
  videoFolderConnecting: boolean;
  onConnectVideoFolder: () => void;
  leagues: League[];
  activeLeagueId: string;
  activeLeague?: League | null;
  teamCount: number;
  matchCount: number;
  onOpenUsageGuide: () => void;
  onOpenContactAdmin: () => void;
  onSelectLeague: (leagueId: string) => void;
  onOpenLeagueManagement: (tab: 'league' | 'teams' | 'matches') => void;
}

export const ScoreboardSetupWizard: React.FC<ScoreboardSetupWizardProps> = React.memo(({
  isStep1Complete,
  isStep2Complete,
  videoFolderConnecting,
  onConnectVideoFolder,
  leagues,
  activeLeagueId,
  activeLeague,
  teamCount,
  matchCount,
  onOpenUsageGuide,
  onOpenContactAdmin,
  onSelectLeague,
  onOpenLeagueManagement,
}) => {
  return (
    <div
      className="card"
      style={{
        padding: '24px',
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        marginTop: '16px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '1.4rem',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <UiIcon name="rocket" /> เริ่มต้นตั้งค่า MatchFlow Studio
        </h2>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
          กรุณาทำตามขั้นตอน <strong>2 ข้อแรก</strong> ด้านล่างให้ครบเพื่อปลดล็อกแผงควบคุมหลัก
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenUsageGuide}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <UiIcon name="bookOpen" /> วิธีการใช้งาน
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenContactAdmin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <UiIcon name="messageCircle" /> ติดต่อ Admin
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {/* Step 1 Card */}
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: isStep1Complete ? 'rgba(6, 78, 59, 0.4)' : '#1e293b',
            border: isStep1Complete ? '1px solid #10b981' : '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                1️⃣ Connect Video Folder
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isStep1Complete ? '#065f46' : '#991b1b',
                  color: isStep1Complete ? '#6ee7b7' : '#fca5a5',
                  fontWeight: 600,
                }}
              >
                {isStep1Complete ? '🟢 เชื่อมต่อแล้ว' : '🔴 ยังไม่เชื่อมต่อ'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
              เลือกโฟลเดอร์คลิปวิดีโอ OBS Replay เพื่อรองรับระบบ Instant Replay และ VAR
            </p>
          </div>
          <button
            type="button"
            className={isStep1Complete ? 'btn-secondary' : 'btn-primary'}
            onClick={onConnectVideoFolder}
            disabled={videoFolderConnecting}
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {videoFolderConnecting
              ? '⏳ กำลังเชื่อมต่อ...'
              : isStep1Complete
              ? '🔄 เปลี่ยนโฟลเดอร์'
              : '📂 เลือกโฟลเดอร์วิดีโอ'}
          </button>
        </div>

        {/* Step 2 Card */}
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: isStep2Complete ? 'rgba(6, 78, 59, 0.4)' : '#1e293b',
            border: isStep2Complete ? '1px solid #10b981' : '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                2️⃣ เลือก/สร้างลีกการแข่งขัน 
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isStep2Complete ? '#065f46' : '#991b1b',
                  color: isStep2Complete ? '#6ee7b7' : '#fca5a5',
                  fontWeight: 600,
                }}
              >
                {isStep2Complete ? '🟢 พร้อมใช้งาน' : '🔴 ยังไม่เลือกลีก'}
              </span>
            </div>
          </div>

          {leagues.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
                  เลือกลีกของคุณ:
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.88rem',
                    background: '#0f172a',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  value={activeLeagueId || ''}
                  onChange={(e) => onSelectLeague(e.target.value)}
                >
                  <option value="">-- โปรดเลือกลีก --</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      🏆 {league.name} {league.season ? `(${league.season})` : ''}
                    </option>
                  ))}
                </select>

                {activeLeague && (
                  <p style={{ fontSize: '0.8rem', color: '#6ee7b7', margin: 0, lineHeight: 1.4 }}>
                    ✅ ลีกปัจจุบัน: <strong>{activeLeague.name}</strong>
                    {teamCount > 0 && ` (${teamCount} ทีม, ${matchCount} แมตช์)`}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onOpenLeagueManagement('matches')}
                  style={{
                    flex: 1,
                    minWidth: '160px',
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <UiIcon name="trophy" style={{ color: '#f59e0b' }} />
                  <span>จัดการลีก</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onOpenLeagueManagement('league')}
                  style={{
                    minWidth: '140px',
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <UiIcon name="plusCircle" />
                  <span> สร้างลีกใหม่</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 4px 0' }}>
                  📋 ยังไม่มีข้อมูลลีกการแข่งขันสำหรับบัญชีนี้
                </p>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  สร้างลีกแรกของคุณเพื่อเริ่มจัดการตารางแข่งขันและทีมผ่าน Supabase
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenLeagueManagement('league')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <UiIcon name="plusCircle" />
                <span>➕ สร้างลีกการแข่งขันใหม่ </span>
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        💡 ทำครบทั้ง 2 ขั้นตอนด้านบนแล้ว ระบบจะเปิดแผงควบคุม Scoreboard ทั้งหมดให้อัตโนมัติ
      </div>
    </div>
  );
});

ScoreboardSetupWizard.displayName = 'ScoreboardSetupWizard';
export default ScoreboardSetupWizard;
