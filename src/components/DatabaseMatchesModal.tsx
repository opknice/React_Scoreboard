import type { CSSProperties } from 'react';
import type { DatabaseMatch } from '../hooks/useScoreboardDatabase';

interface DatabaseMatchesModalProps {
  isOpen: boolean;
  isLoading: boolean;
  matches: DatabaseMatch[];
  searchTerm: string;
  dateFilter: string;
  onSearchChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
  onRefresh: () => void;
  onEdit: (match: DatabaseMatch) => void;
  onDelete: (match: DatabaseMatch) => void;
  onCopyTableUrl: () => void;
  onCopyResultsUrl: () => void;
  onClose: () => void;
  closeLabel: string;
}

export default function DatabaseMatchesModal({
  isOpen,
  isLoading,
  matches,
  searchTerm,
  dateFilter,
  onSearchChange,
  onDateFilterChange,
  onRefresh,
  onEdit,
  onDelete,
  onCopyTableUrl,
  onCopyResultsUrl,
  onClose,
  closeLabel,
}: DatabaseMatchesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-database"></i> จัดการข้อมูลลีกและแมตช์ใน Realtime Database</h3>

        <div className="row space-between" style={{ marginBottom: '12px' }}>
          <input type="text" placeholder="ค้นหา (ชื่อทีม/รอบ)..." value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} style={{ flex: 1, maxWidth: '300px' }} />
          <select value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)}>
            <option value="all">แสดงผลทั้งหมด</option>
            <option value="today">เฉพาะวันนี้</option>
            <option value="week">ภายใน 7 วันนี้</option>
            <option value="month">ภายใน 30 วันนี้</option>
          </select>
          <button className="btn-primary" onClick={onRefresh}><i className="fas fa-sync-alt"></i> รีเฟรช</button>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '350px', background: '#0f1115', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
          {isLoading ? <div style={{ padding: '40px', textAlign: 'center' }}>กำลังโหลดข้อมูล...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#1d212a', borderBottom: '2px solid var(--border-color)' }}><th style={cellStyle('left')}>วันที่</th><th style={cellStyle('left')}>ทีม A</th><th style={cellStyle('center')}>คะแนน</th><th style={cellStyle('left')}>ทีม B</th><th style={cellStyle('center')}>รอบ</th><th style={cellStyle('center')}>จัดการ</th></tr></thead>
              <tbody>
                {matches.length === 0 ? <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted-color)' }}>ไม่พบข้อมูลแมตช์การแข่งขัน</td></tr> : matches.map((match) => (
                  <tr key={match.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={cellStyle('left')}>{match.date}</td><td style={cellStyle('left')}>{match.teamA}</td><td style={cellStyle('center', true)}>{match.scoreA} - {match.scoreB}</td><td style={cellStyle('left')}>{match.teamB}</td><td style={cellStyle('center')}>{match.roundLabel || '-'}</td>
                    <td style={cellStyle('center')}><button className="btn-primary" style={{ padding: '4px 8px', marginRight: '4px' }} onClick={() => onEdit(match)}><i className="fas fa-edit"></i></button><button className="btn-danger" style={{ padding: '4px 8px' }} onClick={() => onDelete(match)}><i className="fas fa-trash"></i></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={onCopyTableUrl}><i className="fas fa-copy"></i> คัดลอกตารางคะแนน Standalone URL</button>
          <button className="btn-success" onClick={onCopyResultsUrl}><i className="fas fa-copy"></i> คัดลอกผลการแข่ง Standalone URL</button>
          <button className="btn-secondary" onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
    </div>
  );
}

function cellStyle(align: 'left' | 'center', bold = false): CSSProperties {
  return { padding: '8px', textAlign: align, fontWeight: bold ? 'bold' : undefined };
}
