export interface SelectableTeam {
  name: string;
  short_name?: string | null;
  color_primary?: string;
  color_secondary?: string;
  logo_url?: string | null;
}

interface TeamSelectModalProps {
  isOpen: boolean;
  target: 'A' | 'B';
  search: string;
  teams: SelectableTeam[];
  closeLabel: string;
  onSearchChange: (value: string) => void;
  onSelect: (team: SelectableTeam) => void;
  onClose: () => void;
}

export default function TeamSelectModal({
  isOpen,
  target,
  search,
  teams,
  closeLabel,
  onSearchChange,
  onSelect,
  onClose,
}: TeamSelectModalProps) {
  if (!isOpen) return null;
  const filteredTeams = teams.filter(
    (row) =>
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      (row.short_name && row.short_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '520px' }}>
        <h3>
          <i className="fas fa-users"></i> เลือกทีม {target}
        </h3>
        <p style={{ color: 'var(--text-muted-color)', margin: '0 0 12px 0', fontSize: '0.88rem' }}>
          เลือกทีมจากฐานข้อมูล Supabase เพื่อนำขึ้นสกอร์บอร์ด
        </p>
        <input
          type="text"
          placeholder="ค้นหาชื่อทีม..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
          autoFocus
        />
        <div className="team-select-grid" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {filteredTeams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted-color)' }}>
              <i className="fas fa-search"></i> ไม่พบทีม
            </div>
          ) : (
            filteredTeams.map((team) => (
              <button
                key={team.name}
                className="team-select-item"
                onClick={() => onSelect(team)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', width: '100%' }}
              >
                <div
                  className="team-select-logo"
                  style={{
                    background: team.color_primary || '#334155',
                    width: '36px',
                    height: '36px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>
                      {(team.short_name || team.name).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>{team.name}</div>
                  {team.short_name && <small style={{ color: '#94a3b8' }}>{team.short_name}</small>}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {team.color_primary && (
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: team.color_primary,
                        border: '1px solid #475569',
                      }}
                      title="สีหลัก"
                    />
                  )}
                  {team.color_secondary && (
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: team.color_secondary,
                        border: '1px solid #475569',
                      }}
                      title="สีรอง"
                    />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
