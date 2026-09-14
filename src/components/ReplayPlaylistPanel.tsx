import { memo } from 'react';
import { formatSize } from '../utils/replayFormatters';
import type {
  ReplayPlaylistItem,
  ReplayPlaylistFailure,
  ReplayPlaylistStatus,
} from '../types/instantReplay';

interface ReplayPlaylistPanelProps {
  items: ReplayPlaylistItem[];
  missingItems: ReplayPlaylistItem[];
  status: ReplayPlaylistStatus;
  currentItemId: string | null;
  currentIndex: number;
  attempt: 0 | 1 | 2;
  failures: ReplayPlaylistFailure[];
  activeScreenCount: number;
  isLoading: boolean;
  isFolderConnected: boolean;
  onPlayAll: () => void;
  onStop: () => void;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string, direction: 'up' | 'down') => void;
  onClear: () => void;
}

function getStatusLabel(status: ReplayPlaylistStatus): string {
  if (status === 'playing') return 'กำลังเล่น';
  if (status === 'loading') return 'กำลังโหลด';
  if (status === 'waiting_for_screen') return 'กำลังรอ Replay Screen';
  if (status === 'stalled') return 'ตรวจพบวิดีโอค้าง';
  if (status === 'retrying') return 'กำลังลองใหม่ 1/1';
  if (status === 'advancing') return 'กำลังไปคลิปถัดไป';
  if (status === 'completed') return 'เล่นครบแล้ว';
  if (status === 'completed_with_errors') return 'เล่นครบแล้วแต่มีข้อผิดพลาด';
  if (status === 'screen_unavailable') return 'ไม่พบ Replay Screen';
  if (status === 'stopped') return 'หยุดแล้ว';
  return 'พร้อมเล่น';
}

function isActiveStatus(status: ReplayPlaylistStatus): boolean {
  return status === 'loading'
    || status === 'waiting_for_screen'
    || status === 'playing'
    || status === 'stalled'
    || status === 'retrying'
    || status === 'advancing';
}

function getItemStatusLabel(
  status: ReplayPlaylistStatus,
  isCurrent: boolean,
  index: number,
  currentIndex: number,
): string {
  if (isCurrent) return getStatusLabel(status);
  if (status === 'playing' && index < currentIndex) return 'เล่นแล้ว';
  return 'รอเล่น';
}

function ReplayPlaylistPanel({
  items,
  missingItems,
  status,
  currentItemId,
  currentIndex,
  attempt,
  failures,
  activeScreenCount,
  isLoading,
  isFolderConnected,
  onPlayAll,
  onStop,
  onRemove,
  onMove,
  onClear,
}: ReplayPlaylistPanelProps) {
  const missingIds = new Set(missingItems.map((item) => item.id));
  const active = isActiveStatus(status);

  return (
    <div className="replay-section replay-playlist-section">
      <div className="replay-section-heading">
        <span>Playlist ไฮไลต์</span>
        <b>{items.length} คลิป · Screen {activeScreenCount}</b>
      </div>

      {!isFolderConnected && (
        <div className="replay-playlist-empty">เชื่อมต่อโฟลเดอร์วิดีโอก่อนใช้งาน Playlist</div>
      )}

      {items.length === 0 ? (
        <div className="replay-playlist-empty">
          ยังไม่มีวิดีโอใน Playlist — กด “เพิ่ม” จากคลังวิดีโอ
        </div>
      ) : (
        <div className="replay-playlist-list">
          {items.map((item, index) => {
            const isCurrent = currentItemId === item.id;
            const isMissing = missingIds.has(item.id);

            return (
              <div
                className={`replay-playlist-item${isCurrent ? ' active' : ''}${isMissing ? ' missing' : ''}`}
                key={item.id}
              >
                <div className="replay-playlist-index">{index + 1}</div>
                <div className="replay-playlist-meta">
                  <div className="replay-playlist-name">
                    <i className="fas fa-film" />
                    <span>{item.fileName}</span>
                    {isCurrent && <span className="active-badge">{getStatusLabel(status)}{attempt === 2 ? ' · ต่อจากจุดค้าง' : ''}</span>}
                  </div>
                  <div className="clip-sub">
                    <span>{formatSize(item.fileSize)}</span>
                    <span>·</span>
                    <span>{isMissing ? 'ไม่พบไฟล์ในโฟลเดอร์' : getItemStatusLabel(status, isCurrent, index, currentIndex)}</span>
                  </div>
                </div>
                <div className="replay-playlist-actions">
                  <button
                    type="button"
                    className="replay-button replay-button-icon"
                    onClick={() => onMove(item.id, 'up')}
                    disabled={index === 0 || active}
                    title="เลื่อนขึ้น"
                    aria-label={`เลื่อน ${item.fileName} ขึ้น`}
                  >
                    <i className="fas fa-chevron-up" />
                  </button>
                  <button
                    type="button"
                    className="replay-button replay-button-icon"
                    onClick={() => onMove(item.id, 'down')}
                    disabled={index === items.length - 1 || active}
                    title="เลื่อนลง"
                    aria-label={`เลื่อน ${item.fileName} ลง`}
                  >
                    <i className="fas fa-chevron-down" />
                  </button>
                  <button
                    type="button"
                    className="replay-button replay-button-icon danger"
                    onClick={() => onRemove(item.id)}
                    disabled={active}
                    title="ลบออกจาก Playlist"
                    aria-label={`ลบ ${item.fileName} ออกจาก Playlist`}
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFolderConnected && missingItems.length > 0 && (
        <div className="replay-playlist-warning">
          <i className="fas fa-triangle-exclamation" />
          <span>{missingItems.length} ไฟล์ไม่อยู่ในโฟลเดอร์ปัจจุบัน ระบบจะข้ามเมื่อกดเล่น</span>
        </div>
      )}

      {failures.length > 0 && (
        <div className="replay-playlist-warning" role="status">
          <i className="fas fa-triangle-exclamation" />
          <span>
            {status === 'completed_with_errors' ? 'เล่นครบแล้วแต่มีข้อผิดพลาด' : 'พบคลิปที่เล่นไม่สำเร็จ'}:
            {' '}{failures.map((failure) => `${failure.fileName} (${failure.lastConfirmedTime.toFixed(1)}s)`).join(', ')}
          </span>
        </div>
      )}

      <div className="replay-playlist-toolbar">
        <button
          type="button"
          className="replay-button replay-button-primary"
          onClick={onPlayAll}
          disabled={items.length === 0 || !isFolderConnected || isLoading || active}
        >
          <i className="fas fa-play" />
          <span>{active ? `${getStatusLabel(status)} ${Math.max(currentIndex + 1, 1)}/${items.length}` : 'เล่นทั้งหมด'}</span>
        </button>
        <button
          type="button"
          className="replay-button"
          onClick={onStop}
          disabled={!active}
        >
          <i className="fas fa-stop" />
          <span>หยุด</span>
        </button>
        <button
          type="button"
          className="replay-button replay-button-danger"
          onClick={onClear}
          disabled={items.length === 0 || active}
        >
          <i className="fas fa-trash-can" />
          <span>ล้าง Playlist</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ReplayPlaylistPanel);
