import React, { useState, useRef } from 'react';
import type { League, Team, Match, Player, PlayerMatchStat } from '../../config/supabaseClient';
import LogoBrowserCropModal from '../LogoBrowserCropModal';
import { cropMetadataToJson, parseCropMetadata } from '../../types/teamLogo';
import {
  getLeagueScaleForContext,
  parseLeagueLogoSizing,
  type LeagueLogoSizingSettings,
} from '../../types/leagueLogoSizing';
import TeamCard from './TeamCard';
import LeagueLogoScaleModal from './LeagueLogoScaleModal';
import LogoStorageProviderSelect from '../LogoStorageProviderSelect';
import { validateLogoFile } from '../../services/logoStorageService';
import type { LogoStorageProvider } from '../../types/logoStorage';
import ModalBackdrop from '../ModalBackdrop';
import PlayerManagementModal from './PlayerManagementModal';

type LogoCropContext = 'overlay' | 'logo-browser';

export interface TeamsTabProps {
  activeLeagueId: string;
  activeLeague: League | null;
  teams: Team[];
  matches: Match[];
  loading: boolean;
  isQuotaExceeded: boolean;
  quotaLoading: boolean;
  onCreateTeam: (data: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => Promise<Team | null>;
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => Promise<Team | null>;
  onUpdateLeague: (leagueId: string, updates: Partial<League>) => Promise<League | null>;
  onDeleteTeam: (teamId: string) => Promise<void> | void;
  onGetPlayers: (teamId: string) => Promise<Player[]>;
  onCreatePlayer: (payload: Omit<Player, 'id' | 'created_at' | 'updated_at'>) => Promise<Player>;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => Promise<Player>;
  onDeletePlayer: (id: string, teamId: string) => Promise<void>;
  onGetPlayerStats: (teamId: string) => Promise<PlayerMatchStat[]>;
  onUpsertPlayerStat: (payload: Omit<PlayerMatchStat, 'id' | 'created_at' | 'updated_at'>) => Promise<PlayerMatchStat>;
  onDeletePlayerStat: (id: string) => Promise<void>;
  onUploadTeamLogo: (
    file: File,
    fileName: string,
    provider?: LogoStorageProvider,
  ) => Promise<string>;
  onIncrementUploadCount: () => Promise<unknown> | void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  activeLeagueId,
  activeLeague,
  teams,
  matches,
  loading,
  isQuotaExceeded,
  quotaLoading,
  onCreateTeam,
  onUpdateTeam,
  onUpdateLeague,
  onDeleteTeam,
  onGetPlayers,
  onCreatePlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onGetPlayerStats,
  onUpsertPlayerStat,
  onDeletePlayerStat,
  onUploadTeamLogo,
  onIncrementUploadCount,
}) => {
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamShortName, setTeamShortName] = useState('');
  const [teamColor1, setTeamColor1] = useState('#ffffff');
  const [teamColor2, setTeamColor2] = useState('#000000');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const [cropEditor, setCropEditor] = useState<{ team: Team; context: LogoCropContext } | null>(null);
  const [previewLogoSizing, setPreviewLogoSizing] = useState<LeagueLogoSizingSettings | null>(null);
  const [isLogoScaleModalOpen, setIsLogoScaleModalOpen] = useState(false);
  const [playerTeam, setPlayerTeam] = useState<Team | null>(null);
  const [storageProvider, setStorageProvider] = useState<LogoStorageProvider>('cloudinary');
  const logoScaleButtonRef = useRef<HTMLButtonElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const leagueLogoSizing = parseLeagueLogoSizing(activeLeague?.settings);
  const effectiveLeagueLogoSizing = previewLogoSizing ?? leagueLogoSizing;

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateLogoFile(file);
    } catch (validationError: unknown) {
      alert(validationError instanceof Error ? validationError.message : 'ไฟล์รูปภาพไม่ถูกต้อง');
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
      return;
    }

    if (quotaLoading) {
      alert('กำลังตรวจสอบโควต้า กรุณารอสักครู่');
      return;
    }

    if (isQuotaExceeded) {
      alert('คุณใช้โควต้าอัปโหลดรูปภาพครบ 10 รูปแล้ว');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const publicUrl = await onUploadTeamLogo(file, file.name, storageProvider);
      await onIncrementUploadCount();
      setTeamLogoUrl(publicUrl);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'โปรดตรวจสอบ Storage Bucket "team-logos" ใน Supabase';
      alert(`ไม่สามารถอัปโหลดโลโก้ได้: ${errorMsg}`);
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    }
  };

  const resetTeamForm = () => {
    setTeamName('');
    setTeamShortName('');
    setTeamColor1('#ffffff');
    setTeamColor2('#000000');
    setTeamLogoUrl('');
    setEditingTeamId(null);
  };

  const closeTeamForm = () => {
    setIsTeamFormOpen(false);
    resetTeamForm();
  };

  const handleOpenCreateTeam = () => {
    resetTeamForm();
    setIsTeamFormOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !activeLeagueId) return;

    if (editingTeamId) {
      await onUpdateTeam(editingTeamId, {
        name: teamName.trim(),
        short_name: teamShortName.trim() || teamName.slice(0, 3).toUpperCase(),
        color_primary: teamColor1,
        color_secondary: teamColor2,
        logo_url: teamLogoUrl.trim(),
      });
    } else {
      await onCreateTeam({
        league_id: activeLeagueId,
        name: teamName.trim(),
        short_name: teamShortName.trim() || teamName.slice(0, 3).toUpperCase(),
        color_primary: teamColor1,
        color_secondary: teamColor2,
        logo_url: teamLogoUrl.trim(),
      });
    }

    // Close and clear the form only after the database operation succeeds.
    closeTeamForm();
  };

  const handleStartEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamShortName(team.short_name || '');
    setTeamColor1(team.color_primary || '#ffffff');
    setTeamColor2(team.color_secondary || '#000000');
    setTeamLogoUrl(team.logo_url || '');
    setIsTeamFormOpen(true);
  };

  const handleCancelEditTeam = () => {
    closeTeamForm();
  };

  return (
    <div>
      {cropEditor && (
        <LogoBrowserCropModal
          isOpen
          team={cropEditor.team}
          cropMetadata={cropEditor.context === 'overlay'
            ? cropEditor.team.overlay_crop_metadata
            : cropEditor.team.logo_browser_crop_metadata}
          cropContext={cropEditor.context}
          initialFrameScalePercent={
            parseCropMetadata(cropEditor.context === 'overlay'
              ? cropEditor.team.overlay_crop_metadata
              : cropEditor.team.logo_browser_crop_metadata)?.frameScalePercent
            ?? getLeagueScaleForContext(effectiveLeagueLogoSizing, cropEditor.context)
          }
          onClose={() => setCropEditor(null)}
          onSave={async (crop) => {
            await onUpdateTeam(cropEditor.team.id, cropEditor.context === 'overlay'
              ? {
                overlay_crop_metadata: cropMetadataToJson(crop),
              }
              : {
                logo_browser_crop_metadata: cropMetadataToJson(crop),
              });
          }}
          onReset={async () => {
            await onUpdateTeam(cropEditor.team.id, cropEditor.context === 'overlay'
              ? {
                overlay_crop_metadata: null,
              }
              : {
                logo_browser_crop_metadata: null,
              });
          }}
        />
      )}

      {activeLeague && (
        <LeagueLogoScaleModal
          isOpen={isLogoScaleModalOpen}
          league={activeLeague}
          teams={teams}
          disabled={loading}
          onUpdateLeague={onUpdateLeague}
          onPreviewSizingChange={setPreviewLogoSizing}
          onClose={() => setIsLogoScaleModalOpen(false)}
          returnFocusRef={logoScaleButtonRef}
        />
      )}

      <PlayerManagementModal
        isOpen={Boolean(playerTeam)}
        leagueId={activeLeagueId}
        team={playerTeam}
        matches={matches}
        loading={loading}
        onClose={() => setPlayerTeam(null)}
        onGetPlayers={onGetPlayers}
        onCreatePlayer={onCreatePlayer}
        onUpdatePlayer={onUpdatePlayer}
        onDeletePlayer={onDeletePlayer}
        onGetStats={onGetPlayerStats}
        onUpsertStat={onUpsertPlayerStat}
        onDeleteStat={onDeletePlayerStat}
      />

      {/* Add/Edit Team Modal */}
      {isTeamFormOpen && (
        <ModalBackdrop
          className="league-team-modal-overlay"
          onEscape={closeTeamForm}
          role="presentation"
        >
          <div
            className="league-card league-team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="league-team-modal-title"
          >
            <div className="league-team-modal-header">
              <h3 id="league-team-modal-title" className="league-card-title">
          <i className="fas fa-user-plus" style={{ color: '#38bdf8' }}></i>
          <span>{editingTeamId ? 'แก้ไขข้อมูลทีม' : 'เพิ่มทีมใหม่ในลีกนี้'}</span>
              </h3>
              <button
                type="button"
                className="league-btn-secondary"
                onClick={closeTeamForm}
                autoFocus
                aria-label="ปิดฟอร์มทีม"
              >
                <i className="fas fa-times"></i> ปิด
              </button>
            </div>
        <form onSubmit={handleSaveTeam}>
          <div className="league-form-grid">
            <div className="league-form-group">
              <label>ชื่อทีม (Team Name) *</label>
              <input
                type="text"
                className="league-form-input"
                placeholder="เช่น แมนเชสเตอร์ ยูไนเต็ด"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
              />
            </div>
            <div className="league-form-group">
              <label>ชื่อย่อ (Short Name)</label>
              <input
                type="text"
                className="league-form-input"
                placeholder="เช่น MUN"
                maxLength={5}
                value={teamShortName}
                onChange={(e) => setTeamShortName(e.target.value.toUpperCase())}
              />
            </div>
            <div className="league-form-group">
              <label>สีหลัก (Primary Color)</label>
              <div className="league-color-picker-wrapper">
                <div className="league-color-circle" style={{ background: teamColor1 }}>
                  <input type="color" value={teamColor1} onChange={(e) => setTeamColor1(e.target.value)} />
                </div>
                <input
                  type="text"
                  className="league-form-input"
                  value={teamColor1}
                  onChange={(e) => setTeamColor1(e.target.value)}
                  style={{ width: '100px' }}
                />
              </div>
            </div>
            <div className="league-form-group">
              <label>สีรอง (Secondary Color)</label>
              <div className="league-color-picker-wrapper">
                <div className="league-color-circle" style={{ background: teamColor2 }}>
                  <input type="color" value={teamColor2} onChange={(e) => setTeamColor2(e.target.value)} />
                </div>
                <input
                  type="text"
                  className="league-form-input"
                  value={teamColor2}
                  onChange={(e) => setTeamColor2(e.target.value)}
                  style={{ width: '100px' }}
                />
              </div>
            </div>
          </div>

          {/* Logo Upload / URL */}
          <div className="league-form-grid" style={{ alignItems: 'center' }}>
            <div className="league-form-group league-team-logo-field">
              <label>โลโก้ทีม (URL ภาพ หรืออัปโหลดไฟล์)</label>
              <div className="league-team-logo-provider-row">
                <label htmlFor="league-team-logo-storage-provider">พื้นที่จัดเก็บ</label>
                <LogoStorageProviderSelect
                  id="league-team-logo-storage-provider"
                  value={storageProvider}
                  onChange={setStorageProvider}
                  disabled={isUploadingLogo}
                  className="league-form-select"
                />
              </div>
              <div className="league-team-logo-input-row">
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="https://.../logo.png หรืออัปโหลดไฟล์ด้านขวา"
                  value={teamLogoUrl}
                  onChange={(e) => setTeamLogoUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="league-btn-secondary"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  <i className={`fas ${isUploadingLogo ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                  <span>{isUploadingLogo ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพ'}</span>
                </button>

                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleLogoFileUpload}
                />
              </div>
            </div>

            {teamLogoUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="league-team-logo">
                  <img src={teamLogoUrl} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>✓ โลโก้พร้อมใช้งาน</span>
              </div>
            )}
          </div>

          <div className="league-team-modal-actions">
            <button type="submit" className="league-btn-primary" disabled={loading || isUploadingLogo}>
              <i className="fas fa-save"></i>
              <span>{editingTeamId ? 'บันทึกการแก้ไข' : 'เพิ่มทีม'}</span>
            </button>
            <button type="button" className="league-btn-secondary" onClick={handleCancelEditTeam}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
        </ModalBackdrop>
      )}

      {/* Teams Cards Grid */}
      <div className="league-card">
        <div className="league-team-list-header">
          <h3 className="league-card-title">
            <i className="fas fa-shield-alt" style={{ color: '#10b981' }}></i>
            <span>รายชื่อทีมในลีกนี้ ({teams.length} ทีม)</span>
          </h3>
          <div className="league-team-list-actions">
            <button
              ref={logoScaleButtonRef}
              type="button"
              className="league-btn-secondary"
              onClick={() => setIsLogoScaleModalOpen(true)}
              disabled={!activeLeague || loading}
            >
              <i className="fas fa-expand-arrows-alt" aria-hidden="true"></i>
              <span>ขนาดโลโก้เริ่มต้นของลีก</span>
            </button>
            <button
              type="button"
              className="league-btn-primary"
              onClick={handleOpenCreateTeam}
              disabled={!activeLeagueId || loading}
            >
              <i className="fas fa-user-plus"></i>
              <span>เพิ่มทีม</span>
            </button>
          </div>
        </div>
        {teams.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>ยังไม่มีทีมในลีกนี้ กดปุ่ม “เพิ่มทีม” เพื่อเพิ่มทีมแรก</p>
        ) : (
          <div className="league-teams-grid">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                leagueLogoSizing={effectiveLeagueLogoSizing}
                disabled={loading}
                onEdit={handleStartEditTeam}
                onManagePlayers={setPlayerTeam}
                onOpenCrop={(selectedTeam, context) => setCropEditor({ team: selectedTeam, context })}
                onResetContext={async (selectedTeam, context) => {
                  await onUpdateTeam(selectedTeam.id, context === 'overlay'
                    ? {
                      overlay_crop_metadata: null,
                    }
                    : {
                      logo_browser_crop_metadata: null,
                    });
                }}
                onDelete={(selectedTeam) => onDeleteTeam(selectedTeam.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsTab;
