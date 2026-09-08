import { memo, useEffect, useState } from 'react';
import type { Player } from '../../config/supabaseClient';
import { useScoreboardTeamPlayers } from '../../hooks/useScoreboardTeamPlayers';
import UiIcon from '../UiIcon';

interface ScoreboardPlayerSelectorProps {
  team: 'A' | 'B';
  teamName: string;
  teamId: string | null;
  leagueId: string;
  selectedPlayerId: string | null;
  fetchPlayers: (teamId: string) => Promise<Player[]>;
  onSelect: (player: Player | null) => void;
  isDisplayed: boolean;
  onShow: (player: Player) => void;
  onHide: () => void;
  canRecordGoal: boolean;
  recordingGoal: boolean;
  onRecordGoalAndShow: (player: Player) => void;
}

function ScoreboardPlayerSelector({
  team,
  teamName,
  teamId,
  leagueId,
  selectedPlayerId,
  fetchPlayers,
  onSelect,
  isDisplayed,
  onShow,
  onHide,
  canRecordGoal,
  recordingGoal,
  onRecordGoalAndShow,
}: ScoreboardPlayerSelectorProps) {
  const { players, loading, error, refresh } = useScoreboardTeamPlayers(teamId, leagueId, fetchPlayers);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [selectedPlayer?.image_url]);

  useEffect(() => {
    if (selectedPlayerId && !loading && !selectedPlayer) {
      onSelect(null);
    }
  }, [loading, onSelect, selectedPlayer, selectedPlayerId]);

  const handleSelectionChange = (value: string) => {
    onSelect(players.find((player) => player.id === value) ?? null);
  };

  return (
    <section className="scoreboard-player-selector" aria-label={`เลือกนักเตะทีม ${team}`}>
      <div className="scoreboard-player-selector-header">
        <div>
          <div className="scoreboard-player-selector-kicker">นักเตะทีม {team}</div>
          <strong>{teamName || `Team ${team}`}</strong>
        </div>
        <button
          type="button"
          className="btn-secondary scoreboard-player-refresh"
          onClick={refresh}
          disabled={!teamId || loading}
          title="รีเฟรชรายชื่อนักเตะ"
          aria-label={`รีเฟรชรายชื่อนักเตะทีม ${team}`}
        >
          <UiIcon name={loading ? 'spinner' : 'sync'} />
        </button>
      </div>

      <select
        className="scoreboard-player-select"
        value={selectedPlayerId ?? ''}
        onChange={(event) => handleSelectionChange(event.target.value)}
        disabled={!teamId || loading || players.length === 0}
        aria-label={`รายชื่อนักเตะทีม ${team}`}
      >
        <option value="">
          {!teamId
            ? 'กรุณาเลือกทีมจาก Supabase'
            : loading
              ? 'กำลังโหลดรายชื่อนักเตะ...'
              : players.length === 0
                ? 'ยังไม่มีรายชื่อนักเตะ'
                : '-- เลือกนักเตะ --'}
        </option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            #{player.jersey_number} — {player.name}
          </option>
        ))}
      </select>

      {error && (
        <div className="scoreboard-player-selector-message scoreboard-player-selector-error" role="alert">
          {error}
        </div>
      )}

      {selectedPlayer ? (
        <div className="scoreboard-player-preview">
          {selectedPlayer.image_url && !imageFailed ? (
            <img
              src={selectedPlayer.image_url}
              alt={`รูปนักเตะ ${selectedPlayer.name}`}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="scoreboard-player-preview-placeholder" aria-hidden="true">
              <UiIcon name="users" />
            </div>
          )}
          <div className="scoreboard-player-preview-details">
            <span className="scoreboard-player-jersey">#{selectedPlayer.jersey_number}</span>
            <strong>{selectedPlayer.name}</strong>
            <span>{selectedPlayer.position}</span>
          </div>
          <div className="scoreboard-player-preview-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onShow(selectedPlayer)}
              title="แสดงนักเตะบน Browser Source"
            >
              <UiIcon name="playCircle" />
              {isDisplayed ? 'แสดงซ้ำ' : 'แสดงบนจอ'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onHide}
              disabled={!isDisplayed}
              title="ซ่อนนักเตะจาก Browser Source"
            >
              <UiIcon name="pause" />
              ซ่อน
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={() => onRecordGoalAndShow(selectedPlayer)}
              disabled={!canRecordGoal || recordingGoal}
              title={canRecordGoal ? 'เพิ่มประตูในสถิติแมตช์ปัจจุบันแล้วแสดงนักเตะ' : 'ต้องเลือกแมตช์ปัจจุบันก่อนบันทึกประตู'}
            >
              <UiIcon name={recordingGoal ? 'spinner' : 'plusCircle'} />
              {recordingGoal ? 'กำลังบันทึก...' : 'บันทึกประตู + แสดง'}
            </button>
          </div>
        </div>
      ) : (
        <div className="scoreboard-player-selector-message">เลือกนักเตะเพื่อดู Preview</div>
      )}
    </section>
  );
}

ScoreboardPlayerSelector.displayName = 'ScoreboardPlayerSelector';

export default memo(ScoreboardPlayerSelector);
