import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Match, Player, PlayerMatchStat, PlayerPosition, Team } from '../../config/supabaseClient';
import ModalBackdrop from '../ModalBackdrop';
import { subscribeTeamData, type LeagueDataTable } from '../../utils/leagueDataEvents';
import { usePlayerImageUploadQuota } from '../../hooks/usePlayerImageUploadQuota';
import { uploadPlayerImage } from '../../services/playerImageStorageService';

interface PlayerManagementModalProps {
  isOpen: boolean;
  leagueId: string;
  team: Team | null;
  matches: Match[];
  loading?: boolean;
  onClose: () => void;
  onGetPlayers: (teamId: string) => Promise<Player[]>;
  onCreatePlayer: (payload: Omit<Player, 'id' | 'created_at' | 'updated_at'>) => Promise<Player>;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<Player>;
  onDeletePlayer: (id: string, teamId: string) => Promise<void>;
  onGetStats: (teamId: string) => Promise<PlayerMatchStat[]>;
  onUpsertStat: (payload: Omit<PlayerMatchStat, 'id' | 'created_at' | 'updated_at'>) => Promise<PlayerMatchStat>;
  onDeleteStat: (id: string) => Promise<void>;
}

const POSITIONS: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'GK', label: 'ผู้รักษาประตู (GK)' },
  { value: 'DF', label: 'กองหลัง (DF)' },
  { value: 'MF', label: 'กองกลาง (MF)' },
  { value: 'FW', label: 'กองหน้า (FW)' },
];

interface PlayerDraft {
  jersey_number: number;
  name: string;
  position: PlayerPosition;
  image_url: string;
  image_public_id: string | null;
}

const EMPTY_DRAFT: PlayerDraft = { jersey_number: 1, name: '', position: 'FW', image_url: '', image_public_id: null };

export default function PlayerManagementModal({
  isOpen, leagueId, team, matches, loading = false, onClose, onGetPlayers, onCreatePlayer,
  onUpdatePlayer, onDeletePlayer, onGetStats, onUpsertStat, onDeleteStat,
}: PlayerManagementModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerMatchStat[]>([]);
  const [draft, setDraft] = useState<PlayerDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);
  const [statsMatchId, setStatsMatchId] = useState('');
  const [statsGoals, setStatsGoals] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const [teamLogoFailed, setTeamLogoFailed] = useState(false);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const playerImageQuota = usePlayerImageUploadQuota();

  useEffect(() => {
    setImagePreviewFailed(false);
  }, [draft.image_url]);

  useEffect(() => {
    setTeamLogoFailed(false);
  }, [team?.logo_url]);

  useEffect(() => {
    if (isOpen && team) return;
    setIsPlayerFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setUploadMessage('');
  }, [isOpen, team]);

  const teamMatches = useMemo(
    () => matches.filter((match) => match.league_id === leagueId && (match.team_a_id === team?.id || match.team_b_id === team?.id)),
    [leagueId, matches, team?.id],
  );

  const contextRef = useRef(0);
  const playersRequestRef = useRef(0);
  const statsRequestRef = useRef(0);
  const [loadError, setLoadError] = useState('');
  const teamId = team?.id;
  const reload = useCallback(async (tables = new Set<LeagueDataTable>(['players', 'player_match_stats'])) => {
    if (!teamId) return;
    const context = contextRef.current;
    setLoadError('');
    try {
      await Promise.all([
        tables.has('players') ? (async () => {
          const request = ++playersRequestRef.current;
          const rows = await onGetPlayers(teamId);
          if (context === contextRef.current && request === playersRequestRef.current) setPlayers(rows);
        })() : undefined,
        tables.has('player_match_stats') ? (async () => {
          const request = ++statsRequestRef.current;
          const rows = await onGetStats(teamId);
          if (context === contextRef.current && request === statsRequestRef.current) setStats(rows);
        })() : undefined,
      ]);
    } catch (error) {
      if (context === contextRef.current) setLoadError(error instanceof Error ? error.message : 'โหลดข้อมูลนักเตะไม่สำเร็จ');
    }
  }, [teamId, onGetPlayers, onGetStats]);

  useEffect(() => {
    contextRef.current += 1;
    setPlayers([]);
    setStats([]);
    setBusy(false);
    if (isOpen && teamId) void reload();
    return () => { contextRef.current += 1; };
  }, [isOpen, teamId, leagueId, reload]);

  useEffect(() => {
    if (!isOpen || !teamId) return;
    return subscribeTeamData(leagueId, teamId, ['players', 'player_match_stats'], (tables) => void reload(tables));
  }, [isOpen, teamId, leagueId, reload]);

  if (!isOpen || !team) return null;

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setUploadMessage('');
  };

  const savePlayer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const context = contextRef.current;
    setBusy(true);
    try {
      if (editingId) {
        const updated = await onUpdatePlayer(editingId, { ...draft, name: draft.name.trim(), team_id: team.id, league_id: leagueId });
        if (context !== contextRef.current) return;
        setPlayers((current) => current.map((player) => player.id === updated.id ? updated : player));
      } else {
        const created = await onCreatePlayer({ ...draft, name: draft.name.trim(), team_id: team.id, league_id: leagueId });
        if (context !== contextRef.current) return;
        setPlayers((current) => [...current, created].sort((a, b) => a.jersey_number - b.jersey_number));
      }
      resetDraft();
      setIsPlayerFormOpen(false);
    } finally {
      if (context === contextRef.current) setBusy(false);
    }
  };

  const editPlayer = (player: Player) => {
    setIsPlayerFormOpen(true);
    setEditingId(player.id);
    setDraft({ jersey_number: player.jersey_number, name: player.name, position: player.position, image_url: player.image_url || '', image_public_id: player.image_public_id || null });
    setUploadMessage('');
  };

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (playerImageQuota.loading) {
      window.alert('กำลังตรวจสอบโควต้ารูปนักเตะ กรุณารอสักครู่');
      return;
    }
    if (playerImageQuota.isQuotaExceeded) {
      window.alert('ใช้โควต้ารูปนักเตะครบ 20 รูปแล้ว');
      return;
    }
    setUploadingImage(true);
    try {
      const result = await uploadPlayerImage(file);
      setDraft((current) => ({ ...current, image_url: result.secureUrl, image_public_id: result.publicId }));
      playerImageQuota.syncRemainingQuota(result.remainingQuota);
      setUploadMessage(result.isUnlimited
        ? 'อัปโหลดรูปนักเตะสำเร็จ — สิทธิ์ไม่จำกัด'
        : `อัปโหลดรูปนักเตะสำเร็จ — เหลือโควต้าอีก ${result.remainingQuota}/20 รูป`);
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'อัปโหลดรูปนักเตะไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const removePlayer = async (player: Player) => {
    if (!window.confirm(`ลบนักเตะ "${player.name}" และสถิติประตูทั้งหมดใช่หรือไม่?`)) return;
    const context = contextRef.current;
    setBusy(true);
    try {
      await onDeletePlayer(player.id, team.id);
      if (context !== contextRef.current) return;
      setPlayers((current) => current.filter((item) => item.id !== player.id));
      setStats((current) => current.filter((item) => item.player_id !== player.id));
      if (statsPlayerId === player.id) setStatsPlayerId(null);
    } finally {
      if (context === contextRef.current) setBusy(false);
    }
  };

  const openStats = (player: Player) => {
    const existing = stats.find((stat) => stat.player_id === player.id);
    setStatsPlayerId(player.id);
    setStatsMatchId(existing?.match_id || teamMatches[0]?.id || '');
    setStatsGoals(existing?.goals || 0);
  };

  const saveStats = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statsPlayerId || !statsMatchId) return;
    const context = contextRef.current;
    setBusy(true);
    try {
      const saved = await onUpsertStat({ league_id: leagueId, match_id: statsMatchId, player_id: statsPlayerId, team_id: team.id, goals: Math.max(0, Math.floor(statsGoals)) });
      if (context !== contextRef.current) return;
      setStats((current) => [...current.filter((stat) => stat.id !== saved.id && !(stat.match_id === saved.match_id && stat.player_id === saved.player_id)), saved]);
    } finally {
      if (context === contextRef.current) setBusy(false);
    }
  };

  const removeStats = async () => {
    const existing = stats.find((stat) => stat.player_id === statsPlayerId && stat.match_id === statsMatchId);
    if (!existing || !window.confirm('ลบสถิติประตูของแมตช์นี้ใช่หรือไม่?')) return;
    const context = contextRef.current;
    setBusy(true);
    try {
      await onDeleteStat(existing.id);
      if (context !== contextRef.current) return;
      setStats((current) => current.filter((stat) => stat.id !== existing.id));
      setStatsGoals(0);
    } finally {
      if (context === contextRef.current) setBusy(false);
    }
  };

  const totalGoals = (playerId: string) => stats.filter((stat) => stat.player_id === playerId).reduce((sum, stat) => sum + stat.goals, 0);

  const togglePlayerForm = () => {
    if (isPlayerFormOpen) {
      resetDraft();
    }
    setIsPlayerFormOpen((current) => !current);
  };

  return createPortal(
    <ModalBackdrop className="league-player-modal-overlay" onEscape={onClose} role="presentation">
      <div className="league-card league-player-modal" role="dialog" aria-modal="true" aria-labelledby="player-modal-title">
        <div className="league-team-modal-header">
          <h3 id="player-modal-title" className="league-card-title"><i className="fas fa-user-shield" style={{ color: '#38bdf8' }} /><span>จัดการนักเตะ</span>{team.logo_url && !teamLogoFailed && <img className="league-player-modal-team-logo" src={team.logo_url} alt={`โลโก้ทีม ${team.name}`} onError={() => setTeamLogoFailed(true)} />}<span> {team.name}</span></h3>
        {loadError && <p role="alert">{loadError}</p>}
          <div className="league-player-modal-header-actions">
            <button type="button" className={isPlayerFormOpen ? 'league-btn-secondary' : 'league-btn-primary'} onClick={togglePlayerForm}>
              <i className={`fas ${isPlayerFormOpen ? 'fa-times' : 'fa-plus'}`} aria-hidden="true" />
              {isPlayerFormOpen ? 'ปิดฟอร์ม' : 'เพิ่มนักเตะ'}
            </button>
            <button type="button" className="league-btn-secondary" onClick={onClose}>ปิด</button>
          </div>
        </div>

        {isPlayerFormOpen && <form onSubmit={savePlayer} className="league-player-form">
          <div className="league-form-grid">
            <div className="league-form-group"><label>หมายเลขเสื้อ *</label><input className="league-form-input" type="number" min={0} max={99} value={draft.jersey_number} onChange={(e) => setDraft({ ...draft, jersey_number: Number(e.target.value) })} required /></div>
            <div className="league-form-group"><label>ชื่อ *</label><input className="league-form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
            <div className="league-form-group"><label>ตำแหน่ง *</label><select className="league-form-select" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value as PlayerPosition })}>{POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></div>
            <div className="league-form-group"><label>รูปภาพ (URL หรืออัปโหลด)</label><div className="league-player-quota-message">{playerImageQuota.loading ? 'กำลังตรวจสอบโควต้า...' : playerImageQuota.quotaMessage}</div><input className="league-form-input" type="url" placeholder="https://..." value={draft.image_url} onChange={(e) => { setDraft({ ...draft, image_url: e.target.value, image_public_id: null }); setUploadMessage(''); }} /><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void uploadImage(e)} disabled={uploadingImage || playerImageQuota.loading || playerImageQuota.isQuotaExceeded} style={{ marginTop: 6 }} />{uploadingImage && <small>กำลังอัปโหลด Cloudinary...</small>}{uploadMessage && <small className="league-player-upload-success">{uploadMessage}</small>}{draft.image_url && !imagePreviewFailed && <div className="league-player-image-preview"><img src={draft.image_url} alt="ตัวอย่างรูปนักเตะ" onError={() => setImagePreviewFailed(true)} /><span>ตัวอย่างรูปนักเตะ</span></div>}{draft.image_url && imagePreviewFailed && <small className="league-player-upload-error">ไม่สามารถโหลดรูปภาพจาก URL นี้ได้</small>}</div>
          </div>
          <div className="league-team-modal-actions"><button className="league-btn-primary" type="submit" disabled={busy || loading}><i className="fas fa-save" /> {editingId ? 'บันทึกแก้ไข' : 'เพิ่มนักเตะ'}</button><button className="league-btn-secondary" type="button" onClick={() => { resetDraft(); setIsPlayerFormOpen(false); }}>{editingId ? 'ยกเลิกแก้ไข' : 'ยกเลิก'}</button></div>
        </form>}

        <div className="league-table-responsive">
          <table className="league-data-table"><thead><tr><th>เบอร์</th><th>นักเตะ</th><th>ตำแหน่ง</th><th>ประตูรวม</th><th>การทำงาน</th></tr></thead><tbody>
            {players.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>ยังไม่มีนักเตะในทีมนี้</td></tr> : players.map((player) => <tr key={player.id}>
              <td>{player.jersey_number}</td><td><span className="league-player-name-cell">{player.image_url && <img src={player.image_url} alt="" />}{player.name}</span></td><td>{player.position}</td><td>{totalGoals(player.id)}</td>
              <td><button type="button" className="league-btn-icon" title="บันทึกประตูรายแมตช์" onClick={() => openStats(player)}><i className="fas fa-futbol" style={{ color: '#f59e0b' }} /></button><button type="button" className="league-btn-icon" title="แก้ไข" onClick={() => editPlayer(player)}><i className="fas fa-edit" style={{ color: '#38bdf8' }} /></button><button type="button" className="league-btn-icon" title="ลบ" onClick={() => void removePlayer(player)}><i className="fas fa-trash" style={{ color: '#ef4444' }} /></button></td>
            </tr>)}
          </tbody></table>
        </div>

        {statsPlayerId && <form className="league-player-stats-form" onSubmit={saveStats}><strong>บันทึกประตูรายแมตช์: {players.find((player) => player.id === statsPlayerId)?.name}</strong><div className="league-form-grid"><div className="league-form-group"><label>แมตช์</label><select className="league-form-select" value={statsMatchId} onChange={(e) => { setStatsMatchId(e.target.value); const old = stats.find((stat) => stat.player_id === statsPlayerId && stat.match_id === e.target.value); setStatsGoals(old?.goals || 0); }}><option value="">-- เลือกแมตช์ --</option>{teamMatches.map((match) => <option key={match.id} value={match.id}>{match.match_number}: {match.team_a_name} vs {match.team_b_name}</option>)}</select></div><div className="league-form-group"><label>จำนวนประตู</label><input className="league-form-input" type="number" min={0} value={statsGoals} onChange={(e) => setStatsGoals(Number(e.target.value))} /></div></div><button className="league-btn-primary" type="submit" disabled={busy || !statsMatchId}>บันทึกสถิติ</button> <button className="league-btn-secondary" type="button" onClick={() => void removeStats()} disabled={busy || !statsMatchId || !stats.some((stat) => stat.player_id === statsPlayerId && stat.match_id === statsMatchId)}>ลบสถิติแมตช์นี้</button></form>}
      </div>
    </ModalBackdrop>,
    document.body,
  );
}
