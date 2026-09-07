import React, { useMemo, useRef, useState } from 'react';
import type { League, Match, Team } from '../../config/supabaseClient';
import MatchEditModal from './MatchEditModal';

type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'postponed';
type StatusFilter = 'all' | MatchStatus;
type SortKey = 'match_date' | 'teams';

const MATCH_STATUSES: MatchStatus[] = ['scheduled', 'in_progress', 'finished', 'postponed'];

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'รอแข่งขัน',
  in_progress: 'กำลังแข่งขัน',
  finished: 'จบการแข่งขัน',
  postponed: 'เลื่อนการแข่งขัน',
};

const getStatusLabel = (status: string): string => {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)
    ? STATUS_LABELS[status as MatchStatus]
    : 'ไม่ทราบสถานะ';
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  return value.slice(0, 10);
};

export interface LeagueDatabaseModalProps {
  isOpen: boolean;
  league: League | null;
  teams: Team[];
  matches: Match[];
  loading: boolean;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => Promise<Match | null>;
  onDeleteMatch: (matchId: string) => Promise<void> | void;
  onClose: () => void;
}

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="league-database-empty">{message}</div>
);

export const LeagueDatabaseModal: React.FC<LeagueDatabaseModalProps> = ({
  isOpen,
  league,
  teams,
  matches,
  loading,
  onUpdateMatch,
  onDeleteMatch,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('match_date');
  const [sortDescending, setSortDescending] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const overlayMouseDownRef = useRef(false);

  const filteredMatches = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('th');

    return matches
      .filter((match) => {
        const matchesStatus = statusFilter === 'all' || match.status === statusFilter;
        if (!matchesStatus) return false;
        if (!normalizedQuery) return true;

        return [match.team_a_name, match.team_b_name, match.label1, match.label2, match.label3]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase('th').includes(normalizedQuery));
      })
      .sort((first, second) => {
        const result = sortKey === 'match_date'
          ? (first.match_date || '').localeCompare(second.match_date || '')
          : `${first.team_a_name} ${first.team_b_name}`.localeCompare(`${second.team_a_name} ${second.team_b_name}`, 'th');
        return sortDescending ? result * -1 : result;
      });
  }, [matches, searchQuery, sortDescending, sortKey, statusFilter]);

  const statusCounts = useMemo(() => {
    return MATCH_STATUSES.reduce<Record<MatchStatus, number>>((counts, status) => {
      counts[status] = matches.filter((match) => match.status === status).length;
      return counts;
    }, {
      scheduled: 0,
      in_progress: 0,
      finished: 0,
      postponed: 0,
    });
  }, [matches]);

  if (!isOpen) return null;

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    overlayMouseDownRef.current = false;
  };

  return (
    <div
      className="league-database-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="league-card league-database-modal league-competition-management-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-database-modal-title"
      >
        <div className="league-database-modal-header">
          <div>
            <h3 id="league-database-modal-title" className="league-card-title">
              <i className="fas fa-database" style={{ color: '#38bdf8' }}></i>
              <span>จัดการการแข่งขันทั้งหมด</span>
            </h3>
            <p className="league-database-modal-subtitle">
              {league ? `${league.name}${league.season ? ` (${league.season})` : ''}` : 'ไม่พบลีกปัจจุบัน'}
            </p>
          </div>
          <button
            type="button"
            className="league-btn-secondary"
            onClick={onClose}
            autoFocus
            aria-label="ปิดหน้าจัดการการแข่งขัน"
          >
            <i className="fas fa-times"></i> ปิด
          </button>
        </div>

        <div className="league-database-modal-content">
          {!league ? (
            <EmptyState message="ยังไม่ได้เลือกลีกปัจจุบัน" />
          ) : (
            <>
              <div className="league-competition-summary" aria-label="สรุปจำนวนการแข่งขัน">
                <div className="league-competition-summary-card">
                  <span className="league-competition-summary-label">ทั้งหมด</span>
                  <strong>{matches.length}</strong>
                </div>
                {MATCH_STATUSES.map((status) => (
                  <div key={status} className={`league-competition-summary-card ${status}`}>
                    <span className="league-competition-summary-label">{STATUS_LABELS[status]}</span>
                    <strong>{statusCounts[status]}</strong>
                  </div>
                ))}
              </div>

              <div className="league-competition-filter-bar">
                <label className="league-competition-filter league-form-group">
                  <span>ค้นหาการแข่งขัน</span>
                  <input
                    type="search"
                    className="league-form-input"
                    placeholder="ค้นหาชื่อทีม รอบ หรือสนาม"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
                <label className="league-competition-filter league-form-group">
                  <span>สถานะ</span>
                  <select
                    className="league-form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">ทุกสถานะ</option>
                    {MATCH_STATUSES.map((status) => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </label>
                <label className="league-competition-filter league-form-group">
                  <span>เรียงตาม</span>
                  <select
                    className="league-form-select"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                  >
                    <option value="match_date">วันที่แข่งขัน</option>
                    <option value="teams">ชื่อทีม</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="league-btn-secondary league-competition-sort-button"
                  onClick={() => setSortDescending((current) => !current)}
                  title={sortDescending ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
                  aria-label={sortDescending ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
                >
                  <i className={`fas ${sortDescending ? 'fa-sort-amount-down-alt' : 'fa-sort-amount-up'}`}></i>
                </button>
              </div>

              <div className="league-database-section-title league-competition-results-title">
                <span><i className="fas fa-list"></i> รายการแข่งขัน</span>
                <span className="league-competition-results-count">
                  แสดง {filteredMatches.length} จาก {matches.length} รายการ
                </span>
              </div>

              {filteredMatches.length === 0 ? (
                <EmptyState message={matches.length === 0 ? 'ยังไม่มีข้อมูลการแข่งขันในลีกนี้' : 'ไม่พบการแข่งขันตามเงื่อนไขที่ค้นหา'} />
              ) : (
                <div className="league-table-responsive">
                  <table className="league-data-table league-competition-table">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>คู่แข่งขัน</th>
                        <th style={{ textAlign: 'center' }}>สกอร์</th>
                        <th>รายละเอียดการแข่งขัน</th>
                        <th style={{ textAlign: 'center' }}>สถานะ</th>
                        <th style={{ textAlign: 'center' }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatches.map((match) => (
                        <tr key={match.id}>
                          <td>{formatDate(match.match_date)}</td>
                          <td>
                            <strong>{match.team_a_name || 'Team A'}</strong>
                            <span className="league-competition-vs">vs</span>
                            <strong>{match.team_b_name || 'Team B'}</strong>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {match.score_a} - {match.score_b}
                          </td>
                          <td className="league-competition-details">
                            {[match.label1, match.label2, match.label3].filter(Boolean).join(' • ') || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${MATCH_STATUSES.includes(match.status as MatchStatus) ? match.status : ''}`}>
                              {getStatusLabel(match.status)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="league-btn-icon"
                              onClick={() => setEditingMatch(match)}
                              title="แก้ไขการแข่งขัน"
                              aria-label="แก้ไขการแข่งขัน"
                            >
                              <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                            </button>
                            <button
                              type="button"
                              className="league-btn-icon"
                              onClick={() => {
                                const teamsLabel = `${match.team_a_name || 'Team A'} vs ${match.team_b_name || 'Team B'}`;
                                const dateLabel = formatDate(match.match_date);
                                const confirmed = window.confirm(
                                  `ต้องการลบการแข่งขัน ${teamsLabel} วันที่ ${dateLabel} ใช่หรือไม่?`
                                );

                                if (confirmed) {
                                  void onDeleteMatch(match.id);
                                }
                              }}
                              title="ลบการแข่งขัน"
                              aria-label="ลบการแข่งขัน"
                              disabled={loading}
                            >
                              <i className="fas fa-trash" style={{ color: '#ef4444' }}></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MatchEditModal
        isOpen={editingMatch !== null}
        match={editingMatch}
        teams={teams}
        matches={matches}
        loading={loading}
        onSave={onUpdateMatch}
        onClose={() => setEditingMatch(null)}
      />
    </div>
  );
};

export default LeagueDatabaseModal;
