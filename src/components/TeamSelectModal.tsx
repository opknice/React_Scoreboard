import type { TeamColorRow } from '../utils/excelParser';

interface TeamSelectModalProps {
  isOpen: boolean;
  target: 'A' | 'B';
  search: string;
  teams: TeamColorRow[];
  closeLabel: string;
  onSearchChange: (value: string) => void;
  onSelect: (teamName: string) => void;
  onClose: () => void;
}

export default function TeamSelectModal({ isOpen, target, search, teams, closeLabel, onSearchChange, onSelect, onClose }: TeamSelectModalProps) {
  if (!isOpen) return null;
  const filteredTeams = teams.filter((row) => !search || row.team.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h3><i className="fas fa-users"></i> เลือกทีม{target}</h3>
        <p style={{ color: 'var(--text-muted-color)', margin: '0 0 12px 0', fontSize: '0.9rem' }}>เลือกทีมจากรายชื่อใน Excel Sheet</p>
        <input type="text" placeholder="ค้นหาทีม..." value={search} onChange={(event) => onSearchChange(event.target.value)} style={{ width: '100%', marginBottom: '12px' }} autoFocus />
        <div className="team-select-grid">
          {filteredTeams.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted-color)' }}><i className="fas fa-search"></i> ไม่พบทีม</div> : filteredTeams.map((row) => (
            <button key={row.team} className="team-select-item" onClick={() => onSelect(row.team)}>
              <div className="team-select-logo" style={{ background: row.color1 || '#333' }}>
                <img src={row.team.startsWith('http://') || row.team.startsWith('https://') ? row.team : `/logos/${encodeURIComponent(row.team.endsWith('.png') ? row.team : `${row.team}.png`)}`} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                {row.team.substring(0, 2).toUpperCase()}
              </div>
              <span style={{ flex: 1, fontWeight: 600, textAlign: 'left', color: '#ffffffff' }}>{row.team}</span>
              {row.color1 && <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: row.color1, border: '2px solid #333', flexShrink: 0 }} />}
              {row.color2 && <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: row.color2, border: '2px solid #333', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </div>
  );
}
