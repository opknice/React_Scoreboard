import React, { useState, useRef } from 'react';
import type { Team } from '../../config/supabaseClient';

export interface TeamsTabProps {
  activeLeagueId: string;
  teams: Team[];
  loading: boolean;
  isQuotaExceeded: boolean;
  quotaLoading: boolean;
  onCreateTeam: (data: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => Promise<Team | null>;
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => Promise<Team | null>;
  onDeleteTeam: (teamId: string) => Promise<void> | void;
  onUploadTeamLogo: (file: File, fileName: string) => Promise<string>;
  onIncrementUploadCount: () => Promise<unknown> | void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  activeLeagueId,
  teams,
  loading,
  isQuotaExceeded,
  quotaLoading,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
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
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const publicUrl = await onUploadTeamLogo(file, file.name);
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
      setEditingTeamId(null);
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

    setTeamName('');
    setTeamShortName('');
    setTeamColor1('#ffffff');
    setTeamColor2('#000000');
    setTeamLogoUrl('');
  };

  const handleStartEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamShortName(team.short_name || '');
    setTeamColor1(team.color_primary || '#ffffff');
    setTeamColor2(team.color_secondary || '#000000');
    setTeamLogoUrl(team.logo_url || '');
  };

  const handleCancelEditTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setTeamShortName('');
    setTeamColor1('#ffffff');
    setTeamColor2('#000000');
    setTeamLogoUrl('');
  };

  return (
    <div>
      {/* Team Form Card */}
      <div className="league-card">
        <h3 className="league-card-title">
          <i className="fas fa-user-plus" style={{ color: '#38bdf8' }}></i>
          <span>{editingTeamId ? 'แก้ไขข้อมูลทีม' : 'เพิ่มทีมใหม่ในลีกนี้'}</span>
        </h3>
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
            <div className="league-form-group" style={{ gridColumn: 'span 2' }}>
              <label>โลโก้ทีม (URL ภาพ หรืออัปโหลดไฟล์ตรงเข้า Supabase Storage)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <i className={`fas ${isUploadingLogo ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                  <span>{isUploadingLogo ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพ'}</span>
                </button>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoFileUpload}
                />
              </div>
            </div>

            {teamLogoUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="league-team-logo" style={{ background: teamColor1 }}>
                  <img src={teamLogoUrl} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>✓ โลโก้พร้อมใช้งาน</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="submit" className="league-btn-primary" disabled={loading}>
              <i className="fas fa-save"></i>
              <span>{editingTeamId ? 'บันทึกการแก้ไข' : 'เพิ่มทีม'}</span>
            </button>
            {editingTeamId && (
              <button type="button" className="league-btn-secondary" onClick={handleCancelEditTeam}>
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Teams Cards Grid */}
      <div className="league-card">
        <h3 className="league-card-title">
          <i className="fas fa-shield-alt" style={{ color: '#10b981' }}></i>
          <span>รายชื่อทีมในลีกนี้ ({teams.length} ทีม)</span>
        </h3>
        {teams.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>ยังไม่มีทีมในลีกนี้ เพิ่มทีมแรกของคุณด้านบน</p>
        ) : (
          <div className="league-teams-grid">
            {teams.map((t) => (
              <div key={t.id} className="league-team-card">
                <div className="league-team-logo" style={{ background: t.color_primary || '#1e293b' }}>
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                  ) : (
                    t.short_name || t.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="league-team-info">
                  <div className="league-team-name">{t.name}</div>
                  <div className="league-team-colors">
                    <span className="league-color-dot" style={{ background: t.color_primary }} title="สีหลัก" />
                    <span className="league-color-dot" style={{ background: t.color_secondary }} title="สีรอง" />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '4px' }}>{t.short_name}</span>
                  </div>
                </div>
                <button type="button" className="league-btn-icon" onClick={() => handleStartEditTeam(t)} title="แก้ไข">
                  <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                </button>
                <button
                  type="button"
                  className="league-btn-icon"
                  onClick={() => {
                    if (window.confirm(`ลบทีม "${t.name}"?`)) onDeleteTeam(t.id);
                  }}
                  title="ลบ"
                >
                  <i className="fas fa-trash" style={{ color: '#ef4444' }}></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsTab;
