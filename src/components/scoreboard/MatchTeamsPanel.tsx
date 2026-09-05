import React from 'react';
import UiIcon from '../UiIcon';

export interface MatchTeamsPanelProps {
  scoreA: number;
  scoreB: number;
  nameA: string;
  nameB: string;
  colorA1: string;
  colorA2: string;
  colorB1: string;
  colorB2: string;
  logoA: string;
  logoB: string;
  isEditingA: boolean;
  isEditingB: boolean;
  editNameAVal: string;
  editNameBVal: string;
  hasSupabaseTeams: boolean;
  resetLabel: string;
  onAddGoal: (team: 'A' | 'B') => void;
  onMinusScore: (team: 'A' | 'B') => void;
  onColorChange: (team: 'A' | 'B', which: 1 | 2, color: string) => void;
  onQuickColor: (team: 'A' | 'B', color: string) => void;
  onLogoClick: () => void;
  onStartEditName: (team: 'A' | 'B') => void;
  onEditNameValChange: (team: 'A' | 'B', val: string) => void;
  onSaveEditName: (team: 'A' | 'B') => void;
  onOpenTeamSelect: (target: 'A' | 'B') => void;
  onSwapTeams: () => void;
  onResetScore: () => void;
  getLogoSrc: (logoName: string, teamName?: string) => string;
}

const QUICK_COLORS = ['#98F527', '#FFEF00', '#F52727'];

function renderTeamName(teamName: string) {
  return teamName.split('/').map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {index > 0 && <br />}
      {part}
    </React.Fragment>
  ));
}

function getTeamInitials(nameStr: string) {
  if (!nameStr) return '';
  const parts = nameStr.split(' ').filter(Boolean);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : nameStr.substring(0, 2)).toUpperCase();
}

export const MatchTeamsPanel: React.FC<MatchTeamsPanelProps> = React.memo(({
  scoreA,
  scoreB,
  nameA,
  nameB,
  colorA1,
  colorA2,
  colorB1,
  colorB2,
  logoA,
  logoB,
  isEditingA,
  isEditingB,
  editNameAVal,
  editNameBVal,
  hasSupabaseTeams,
  resetLabel,
  onAddGoal,
  onMinusScore,
  onColorChange,
  onQuickColor,
  onLogoClick,
  onStartEditName,
  onEditNameValChange,
  onSaveEditName,
  onOpenTeamSelect,
  onSwapTeams,
  onResetScore,
  getLogoSrc,
}) => {
  return (
    <div className="card" style={{ padding: '12px', overflowX: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'nowrap',
          minWidth: '540px',
        }}
      >
        {/* Score Team A */}
        <div className="score-buttons" style={{ flexShrink: 0 }}>
          <button className="plus" onClick={() => onAddGoal('A')}>
            +
          </button>
          <button className="minus" onClick={() => onMinusScore('A')}>
            -
          </button>
        </div>

        <div className="score-display" style={{ flexShrink: 0 }}>
          {scoreA}
        </div>

        {/* Team Row A */}
        <div className="team-row" style={{ flex: '1 1 0%', minWidth: '120px' }}>
          <div className="color-picker-stack">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                className="color-picker"
                value={colorA1}
                onChange={(e) => onColorChange('A', 1, e.target.value)}
              />
              <input
                type="color"
                className="color-picker"
                value={colorA2}
                onChange={(e) => onColorChange('A', 2, e.target.value)}
              />
            </div>
            {/* Quick colors */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {QUICK_COLORS.map((c) => (
                <div
                  key={c}
                  className="quick-color-box"
                  style={{ background: c }}
                  onClick={() => onQuickColor('A', c)}
                />
              ))}
            </div>
          </div>

          <div
            className="logo-container"
            title="คลิกเพื่อจัดการรายชื่อทีมและอัปโหลดโลโก้ (Supabase)"
            onClick={onLogoClick}
          >
            {logoA || nameA ? (
              <img
                key={`${logoA}-${nameA}`}
                src={getLogoSrc(logoA, nameA)}
                alt=""
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <div className="logo-initials">{getTeamInitials(nameA)}</div>
            <span className="logo-upload-icon" aria-hidden="true"><UiIcon name="camera" /></span>
          </div>

          <div className="name-control-area">
            {isEditingA ? (
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <input
                  type="text"
                  value={editNameAVal}
                  onChange={(e) => onEditNameValChange('A', e.target.value)}
                  style={{ width: '100%' }}
                />
                <button className="btn-success" onClick={() => onSaveEditName('A')}>
                  OK
                </button>
              </div>
            ) : (
              <>
                <div className="name">{renderTeamName(nameA)}</div>
                <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center' }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, maxWidth: '90px' }}
                    onClick={() => onStartEditName('A')}
                  >
                    <UiIcon name="pencil" />
                  </button>
                  {hasSupabaseTeams && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                      title="เลือกทีมจากรายชื่อใน Supabase"
                      onClick={() => onOpenTeamSelect('A')}
                    >
                      <UiIcon name="users" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center Swapper */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <button
            className="btn-warning"
            onClick={onSwapTeams}
            style={{ height: '42px', width: '42px', borderRadius: '50%', fontSize: '1.1rem' }}
          >
            <UiIcon name="exchange" />
          </button>
          <button
            className="btn-secondary"
            onClick={onResetScore}
            style={{ borderRadius: '20px', fontSize: '0.75rem' }}
          >
            <UiIcon name="sync" />
            <span>{resetLabel}</span>
          </button>
        </div>

        {/* Team Row B */}
        <div className="team-row" style={{ flex: '1 1 0%', minWidth: '120px' }}>
          <div className="color-picker-stack">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                className="color-picker"
                value={colorB1}
                onChange={(e) => onColorChange('B', 1, e.target.value)}
              />
              <input
                type="color"
                className="color-picker"
                value={colorB2}
                onChange={(e) => onColorChange('B', 2, e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {QUICK_COLORS.map((c) => (
                <div
                  key={c}
                  className="quick-color-box"
                  style={{ background: c }}
                  onClick={() => onQuickColor('B', c)}
                />
              ))}
            </div>
          </div>

          <div
            className="logo-container"
            title="คลิกเพื่อจัดการรายชื่อทีมและอัปโหลดโลโก้ (Supabase)"
            onClick={onLogoClick}
          >
            {logoB || nameB ? (
              <img
                key={`${logoB}-${nameB}`}
                src={getLogoSrc(logoB, nameB)}
                alt=""
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <div className="logo-initials">{getTeamInitials(nameB)}</div>
            <span className="logo-upload-icon" aria-hidden="true"><UiIcon name="camera" /></span>
          </div>

          <div className="name-control-area">
            {isEditingB ? (
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <input
                  type="text"
                  value={editNameBVal}
                  onChange={(e) => onEditNameValChange('B', e.target.value)}
                  style={{ width: '100%' }}
                />
                <button className="btn-success" onClick={() => onSaveEditName('B')}>
                  OK
                </button>
              </div>
            ) : (
              <>
                <div className="name">{renderTeamName(nameB)}</div>
                <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center' }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, maxWidth: '90px' }}
                    onClick={() => onStartEditName('B')}
                  >
                    <UiIcon name="pencil" />
                  </button>
                  {hasSupabaseTeams && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                      title="เลือกทีมจากรายชื่อใน Supabase"
                      onClick={() => onOpenTeamSelect('B')}
                    >
                      <UiIcon name="users" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="score-display" style={{ flexShrink: 0 }}>
          {scoreB}
        </div>

        {/* Score Team B */}
        <div className="score-buttons" style={{ flexShrink: 0 }}>
          <button className="plus" onClick={() => onAddGoal('B')}>
            +
          </button>
          <button className="minus" onClick={() => onMinusScore('B')}>
            -
          </button>
        </div>
      </div>
    </div>
  );
});

MatchTeamsPanel.displayName = 'MatchTeamsPanel';
export default MatchTeamsPanel;
