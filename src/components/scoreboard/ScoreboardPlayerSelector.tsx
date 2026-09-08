import { createPortal } from 'react-dom';
import { memo, useEffect, useId, useState } from 'react';
import type { Player } from '../../config/supabaseClient';
import { useScoreboardTeamPlayers } from '../../hooks/useScoreboardTeamPlayers';
import ModalBackdrop from '../ModalBackdrop';
import UiIcon from '../UiIcon';

interface ScoreboardPlayerSelectorProps {
  team: 'A' | 'B';
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
  const { players, loading, error } = useScoreboardTeamPlayers(teamId, leagueId, fetchPlayers);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const [pendingShowPlayer, setPendingShowPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (selectedPlayerId && !loading && !selectedPlayer) {
      onSelect(null);
    }
  }, [loading, onSelect, selectedPlayer, selectedPlayerId]);

  const handleSelectionChange = (value: string) => {
    onSelect(players.find((player) => player.id === value) ?? null);
  };

  const handleShowToggle = () => {
    if (!selectedPlayer) return;
    if (isDisplayed) {
      onHide();
      return;
    }
    setPendingShowPlayer(selectedPlayer);
  };

  const closeShowDialog = () => setPendingShowPlayer(null);

  const handleShowOnly = () => {
    if (!pendingShowPlayer) return;
    const player = pendingShowPlayer;
    closeShowDialog();
    onShow(player);
  };

  const handleRecordGoalAndShow = () => {
    if (!pendingShowPlayer || !canRecordGoal || recordingGoal) return;
    const player = pendingShowPlayer;
    closeShowDialog();
    onRecordGoalAndShow(player);
  };

  return (
    <section className="scoreboard-player-selector" aria-label={`เลือกนักเตะทีม ${team}`}>
      <div className="scoreboard-player-selector-header">
        <button
          type="button"
          className={`${isDisplayed ? 'btn-secondary' : 'btn-primary'} scoreboard-player-show-toggle`}
          onClick={handleShowToggle}
          disabled={!selectedPlayer}
          title={isDisplayed ? 'ซ่อนนักเตะจาก Browser Source' : 'แสดงนักเตะบน Browser Source'}
          aria-label={isDisplayed ? `ซ่อนนักเตะทีม ${team}` : `แสดงนักเตะทีม ${team}`}
        >
          <UiIcon name={isDisplayed ? 'pause' : 'playCircle'} />
          {isDisplayed ? 'ซ่อน' : 'แสดง'}
        </button>
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
      </div>

      {error && (
        <div className="scoreboard-player-selector-message scoreboard-player-selector-error" role="alert">
          {error}
        </div>
      )}

      {pendingShowPlayer && (
        <PlayerShowDecisionDialog
          player={pendingShowPlayer}
          canRecordGoal={canRecordGoal}
          recordingGoal={recordingGoal}
          onRecordGoalAndShow={handleRecordGoalAndShow}
          onShowOnly={handleShowOnly}
          onClose={closeShowDialog}
        />
      )}
    </section>
  );
}

interface PlayerShowDecisionDialogProps {
  player: Player;
  canRecordGoal: boolean;
  recordingGoal: boolean;
  onRecordGoalAndShow: () => void;
  onShowOnly: () => void;
  onClose: () => void;
}

function PlayerShowDecisionDialog({
  player,
  canRecordGoal,
  recordingGoal,
  onRecordGoalAndShow,
  onShowOnly,
  onClose,
}: PlayerShowDecisionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return createPortal(
    <ModalBackdrop
      className="scoreboard-player-decision-overlay"
      onEscape={onClose}
      role="presentation"
    >
      <section
        className="scoreboard-player-decision-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="scoreboard-player-decision-header">
          <div>
            <h3 id={titleId}>
              <UiIcon name="users" />
              แสดงนักเตะบน Browser Source
            </h3>
            <p id={descriptionId}>
              ต้องการบันทึกเพิ่ม score นักเตะ <strong>#{player.jersey_number} — {player.name}</strong> ด้วยไหม
            </p>
          </div>
          <button type="button" className="scoreboard-player-decision-close modal-header-close" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="scoreboard-player-decision-actions">
          <button
            type="button"
            className="btn-success"
            onClick={onRecordGoalAndShow}
            disabled={!canRecordGoal || recordingGoal}
            title={canRecordGoal ? 'บันทึกประตูในสถิติแมตช์ปัจจุบันแล้วแสดงนักเตะ' : 'ต้องเลือกแมตช์ปัจจุบันก่อนบันทึกประตู'}
          >
            <UiIcon name={recordingGoal ? 'spinner' : 'plusCircle'} />
            {recordingGoal ? 'กำลังบันทึก...' : 'บันทึกประตู + แสดง'}
          </button>
          <button type="button" className="btn-primary" onClick={onShowOnly}>
            <UiIcon name="playCircle" />
            แสดงอย่างเดียว
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            <span aria-hidden="true">×</span>
            ยกเลิก
          </button>
        </div>

        {!canRecordGoal && (
          <p className="scoreboard-player-decision-hint" role="status">
            ต้องเลือกแมตช์ปัจจุบันก่อนจึงจะบันทึกประตูได้ แต่ยังสามารถแสดงนักเตะอย่างเดียวได้
          </p>
        )}
      </section>
    </ModalBackdrop>,
    document.body,
  );
}

ScoreboardPlayerSelector.displayName = 'ScoreboardPlayerSelector';

export default memo(ScoreboardPlayerSelector);
