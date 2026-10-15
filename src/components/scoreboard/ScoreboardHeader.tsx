import React from 'react';
import type { User } from '@supabase/supabase-js';
import type { AccessDecision } from '../../types/authAccess';
import UserAvatar from '../UserAvatar';
import { FREE_TRIAL_DAYS, formatTrialRemaining } from '../../utils/trialAccess';
import UiIcon from '../UiIcon';
import { useObsVideoFolderFiles } from '../../context/useObsVideoFolderContext';

function VideoFileCount() {
  const { videoFiles } = useObsVideoFolderFiles();
  return <>{videoFiles.length} files</>;
}

export interface ScoreboardHeaderProps {
  embedded?: boolean;
  videoFolder: {
    isConnected: boolean;
    isConnecting: boolean;
    folderName: string;
    savedPath: string;
  };
  onConnectVideoFolder: () => void;
  onResetVideoFolder: () => void;
  currentUser: User | null;
  authAccess: AccessDecision | null;
  isSuperAdminUser: boolean;
  onNavigatePlans: () => void;
  onNavigateWhitelist: () => void;
  onLogout: () => void;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = React.memo(({
  embedded = false,
  videoFolder,
  onConnectVideoFolder,
  onResetVideoFolder,
  currentUser,
  authAccess,
  isSuperAdminUser,
  onNavigatePlans,
  onNavigateWhitelist,
  onLogout,
}) => {
  const trialDaysRemaining = Math.max(1, authAccess?.trialDaysRemaining ?? 1);
  const trialRemainingLabel = authAccess?.trialExpiresAt
    ? formatTrialRemaining(authAccess.trialExpiresAt)
    : '';

  return (
    <div
      className={embedded ? 'scoreboard-header-row' : 'card'}
      style={embedded ? undefined : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      <div className="app-brand" aria-label="MatchFlow Studio">
        <span className="app-brand__name">
          <span className="app-brand__matchflow">MatchFlow</span> Studio
        </span>
        <span className="app-brand__tagline">Football Broadcast Control</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className={`video-folder-status ${videoFolder.isConnected ? 'is-connected' : 'is-disconnected'}`}
            onClick={onConnectVideoFolder}
            disabled={videoFolder.isConnecting}
            title={
              videoFolder.isConnected
                ? `โฟลเดอร์: ${videoFolder.folderName}\nPath: ${videoFolder.savedPath || 'ไม่ได้ระบุ'}\n\nคลิกเพื่อเปลี่ยนโฟลเดอร์`
                : 'คลิกเพื่อเลือกโฟลเดอร์วิดีโอ OBS Replay'
            }
          >
            <span className="video-folder-status-dot" />
            {videoFolder.isConnecting ? (
              <span>Connecting ....</span>
            ) : videoFolder.isConnected ? (
              <span>
                📂 {videoFolder.savedPath || videoFolder.folderName} (<VideoFileCount />)
              </span>
            ) : (
              <span>Status OFF</span>
            )}
          </button>
          {videoFolder.isConnected && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onResetVideoFolder}
              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }}
              title="รีเซ็ตและเลือกโฟลเดอร์ใหม่"
            >
              ✕
            </button>
          )}
        </div>
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <UserAvatar user={currentUser} size={22} />
            <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
              {currentUser.email}
            </span>
            {authAccess?.accessType === 'whitelist' && (
              <span
                className="user-access-badge user-access-badge--vip"
                title="บัญชี VIP: ได้รับสิทธิ์ใช้งานผ่าน Whitelist"
                aria-label="บัญชี VIP: ได้รับสิทธิ์ใช้งานผ่าน Whitelist"
              >
                <UiIcon name="crown" size="0.85em" /> VIP
              </span>
            )}
            {authAccess?.accessType === 'trial' && authAccess.trialExpiresAt && (
              <button
                type="button"
                className="trial-access-badge"
                title={`ระยะเวลาทดลองใช้งานฟรี ${FREE_TRIAL_DAYS} วัน · ${trialRemainingLabel} · คลิกเพื่อดูรายละเอียด Trial และ VIP`}
                aria-label={`ระยะเวลาทดลองใช้งานฟรี ${trialRemainingLabel} ดูรายละเอียด Trial และ VIP`}
                onClick={onNavigatePlans}
              >
                <span className="trial-access-badge__icon" aria-hidden="true">🎁</span>
                <span className="trial-access-badge__content">
                  <strong>ทดลองใช้ฟรี</strong>
                  <span>{trialRemainingLabel}</span>
                </span>
                <span className="trial-access-badge__compact">
                  ทดลองใช้ฟรี · เหลือ {trialDaysRemaining} วัน
                </span>
              </button>
            )}
            {isSuperAdminUser && (
              <button
                onClick={onNavigateWhitelist}
                className="btn-primary"
                style={{ padding: '3px 8px', fontSize: '0.72rem', marginLeft: '2px' }}
                title="จัดการ Whitelist"
              >
                🛡️ Whitelist
              </button>
            )}
            <button
              onClick={onLogout}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: '0.72rem', marginLeft: '2px' }}
              title="ออกจากระบบ"
            >
              <UiIcon name="logout" /> ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ScoreboardHeader.displayName = 'ScoreboardHeader';
export default ScoreboardHeader;
