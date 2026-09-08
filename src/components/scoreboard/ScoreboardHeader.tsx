import React from 'react';
import type { User } from '@supabase/supabase-js';
import type { AccessDecision } from '../../types/authAccess';
import UserAvatar from '../UserAvatar';
import { formatTrialRemaining } from '../../utils/trialAccess';
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
  onNavigateWhitelist,
  onLogout,
}) => {
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
      {/* Placeholder - เว้นว่างไว้ */}
      <div style={{ minHeight: '20px' }}></div>
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
            {authAccess?.accessType === 'trial' && authAccess.trialExpiresAt && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#7dd3fc',
                  background: 'rgba(14, 165, 233, 0.14)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  whiteSpace: 'nowrap',
                }}
                title="ระยะเวลาทดลองใช้งานฟรี 7 วัน"
              >
                🎁 {formatTrialRemaining(authAccess.trialExpiresAt)}
              </span>
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
