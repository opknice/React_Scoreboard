import { useEffect, useRef, useState } from 'react';
import type { Team } from '../../config/supabaseClient';
import { parseCropMetadata } from '../../types/teamLogo';
import {
  getLeagueScaleForContext,
  type LeagueLogoSizingSettings,
} from '../../types/leagueLogoSizing';

type LogoCropContext = 'overlay' | 'logo-browser';

interface TeamCardProps {
  team: Team;
  disabled?: boolean;
  onEdit: (team: Team) => void;
  onOpenCrop: (team: Team, context: LogoCropContext) => void;
  onResetContext: (team: Team, context: LogoCropContext) => Promise<void> | void;
  onDelete: (team: Team) => Promise<void> | void;
  leagueLogoSizing: LeagueLogoSizingSettings;
}

interface LogoStatusProps {
  context: LogoCropContext;
  hasCrop: boolean;
}

const CONTEXT_LABELS: Record<LogoCropContext, string> = {
  overlay: 'Overlay Crop',
  'logo-browser': 'Browser Crop',
};

function LogoStatus({ context, hasCrop }: LogoStatusProps) {
  const fullStatus = hasCrop ? 'ปรับภาพด้วย Crop แล้ว' : 'ยังไม่ได้ปรับภาพด้วย Crop';

  return (
    <div
      className={`league-team-logo-status league-team-logo-status--${context}`}
      title={`${CONTEXT_LABELS[context]}: ${fullStatus}`}
    >
      <span className="league-team-logo-status-context">{CONTEXT_LABELS[context]}</span>
      <span
        className={`league-team-crop-state${hasCrop ? ' is-ready' : ''}`}
        aria-label={fullStatus}
      >
        <i className="fas fa-circle" aria-hidden="true"></i>
      </span>
    </div>
  );
}

export default function TeamCard({
  team,
  disabled = false,
  onEdit,
  onOpenCrop,
  onResetContext,
  onDelete,
  leagueLogoSizing,
}: TeamCardProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  const overlayCrop = parseCropMetadata(team.overlay_crop_metadata);
  const browserCrop = parseCropMetadata(team.logo_browser_crop_metadata);
  const hasOverlayCrop = overlayCrop !== null;
  const hasBrowserCrop = browserCrop !== null;
  const hasUsableLogo = Boolean(team.logo_url) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [team.logo_url]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreMenuOpen]);

  const resetContext = (context: LogoCropContext) => {
    const label = CONTEXT_LABELS[context];
    const inheritedScale = getLeagueScaleForContext(leagueLogoSizing, context);
    if (!window.confirm(`รีเซ็ต ${label} ของทีม "${team.name}" และกลับไปใช้ขนาดลีก ${inheritedScale}% ใช่หรือไม่?`)) return;
    setIsMoreMenuOpen(false);
    void onResetContext(team, context);
  };

  const deleteTeam = () => {
    if (!window.confirm(`ลบทีม "${team.name}"?`)) return;
    setIsMoreMenuOpen(false);
    void onDelete(team);
  };

  return (
    <article className="league-team-card" ref={cardRef}>
      <div className="league-team-card-header">
        <div className="league-team-logo" aria-hidden="true">
          {team.logo_url && !imageFailed ? (
            <img src={team.logo_url} alt="" onError={() => setImageFailed(true)} />
          ) : (
            team.short_name || team.name.slice(0, 2).toUpperCase()
          )}
        </div>

        <div className="league-team-info">
          <div className="league-team-name" title={team.name}>{team.name}</div>
          <div className="league-team-colors">
            <span className="league-color-dot" style={{ background: team.color_primary }} title="สีหลัก" />
            <span className="league-color-dot" style={{ background: team.color_secondary }} title="สีรอง" />
            <span className="league-team-short-name">{team.short_name}</span>
          </div>
        </div>

        <div className="league-team-card-tools">
          <div className="league-team-logo-statuses" aria-label="สถานะโลโก้">
            <LogoStatus context="overlay" hasCrop={hasOverlayCrop} />
            <LogoStatus context="logo-browser" hasCrop={hasBrowserCrop} />
          </div>

          <div className="league-team-menu-area">
            <button
              type="button"
              className="league-team-more-button"
              onClick={() => setIsMoreMenuOpen((current) => !current)}
              aria-label={`คำสั่งเพิ่มเติมสำหรับทีม ${team.name}`}
              aria-haspopup="menu"
              aria-expanded={isMoreMenuOpen}
              disabled={disabled}
            >
              <i className="fas fa-ellipsis-v" aria-hidden="true"></i>
            </button>

            {isMoreMenuOpen && (
              <div className="league-team-more-menu" role="menu" aria-label={`คำสั่งเพิ่มเติมสำหรับทีม ${team.name}`}>
                <button type="button" role="menuitem" onClick={() => resetContext('overlay')} disabled={!hasOverlayCrop || disabled}>
                  <i className="fas fa-undo" aria-hidden="true"></i>
                  รีเซ็ต Overlay
                </button>
                <button type="button" role="menuitem" onClick={() => resetContext('logo-browser')} disabled={!hasBrowserCrop || disabled}>
                  <i className="fas fa-undo" aria-hidden="true"></i>
                  รีเซ็ต Logo Browser
                </button>
                <div className="league-team-menu-divider" role="separator"></div>
                <button type="button" role="menuitem" className="is-danger" onClick={deleteTeam} disabled={disabled}>
                  <i className="fas fa-trash" aria-hidden="true"></i>
                  ลบทีม
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="league-team-card-actions">
        <button type="button" onClick={() => onEdit(team)} disabled={disabled}>
          <i className="fas fa-edit" aria-hidden="true"></i>
          <span>แก้ไขทีม</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenCrop(team, 'overlay')}
          disabled={!hasUsableLogo || disabled}
          title={!hasUsableLogo ? 'เพิ่มโลโก้ทีมก่อนตั้งค่า Crop' : 'ตั้งค่า Crop สำหรับ Overlay'}
        >
          <i className="fas fa-layer-group" aria-hidden="true"></i>
          <span>Overlay Crop</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenCrop(team, 'logo-browser')}
          disabled={!hasUsableLogo || disabled}
          title={!hasUsableLogo ? 'เพิ่มโลโก้ทีมก่อนตั้งค่า Crop' : 'ตั้งค่า Crop สำหรับ Logo Browser'}
        >
          <i className="fas fa-image" aria-hidden="true"></i>
          <span>Browser Crop</span>
        </button>
      </div>
    </article>
  );
}
