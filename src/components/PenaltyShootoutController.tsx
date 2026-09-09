import ModalCloseButton from './ModalCloseButton';
import { useState, useEffect, useRef, useCallback } from 'react';
import { translations } from '../constants/translations';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import ModalBackdrop from './ModalBackdrop';

interface PenaltyShots {
  A: (boolean | null)[][];
  B: (boolean | null)[][];
}

interface PenaltyScores {
  A: number;
  B: number;
}

interface PenaltySettings {
  dotSize: number;
  dotGap: number;
  teamGap: number;
  layout: 'side-by-side' | 'top-bottom';
}

interface PenaltyShootoutControllerProps {
  obs?: any; // OBS connection from parent
  teamNameA?: string; // Team A name from parent
  teamNameB?: string; // Team B name from parent
  onClose?: () => void; // Callback when closing
}

function getShotsForPage(team: 'A' | 'B', page: number, currentShots: PenaltyShots): (boolean | null)[] {
  const pageShots = currentShots[team][page] || [];
  const displayArray = Array<boolean | null>(5).fill(null);
  for (let i = 0; i < pageShots.length; i += 1) {
    displayArray[i] = pageShots[i];
  }
  return displayArray;
}

export default function PenaltyShootoutController({ obs: parentObs, teamNameA: propTeamNameA, teamNameB: propTeamNameB, onClose: _onClose }: PenaltyShootoutControllerProps = {}) {
  // --- States ---
  const [currentLang] = useState<string>(() => localStorage.getItem('penalty_language') || 'th');
  const [shots, setShots] = useState<PenaltyShots>({ A: [[]], B: [[]] });
  const [scores, setScores] = useState<PenaltyScores>({ A: 0, B: 0 });
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Team names - use props if provided, otherwise use localStorage
  const [teamNameA, setTeamNameA] = useState<string>(propTeamNameA || localStorage.getItem('penalty_teamA') || 'ทีม A');
  const [teamNameB, setTeamNameB] = useState<string>(propTeamNameB || localStorage.getItem('penalty_teamB') || 'ทีม B');

  // Update team names when props change
  useEffect(() => {
    if (propTeamNameA) setTeamNameA(propTeamNameA);
    if (propTeamNameB) setTeamNameB(propTeamNameB);
  }, [propTeamNameA, propTeamNameB]);

  // Dot Settings
  const [settings, setSettings] = useState<PenaltySettings>(() => {
    const saved = localStorage.getItem('penalty_settings');
    return saved
      ? JSON.parse(saved)
      : { dotSize: 150, dotGap: 45, teamGap: 600, layout: 'side-by-side' };
  });

  // Modal Visibility
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Toast States
  const [toasts, setToasts] = useState<{ id: string; message: string; type: string }[]>([]);

  const triggerToast = (message: string, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // OBS hook - use parent's OBS connection if provided, otherwise create own
  const localObs = useOBSWebSocket();
  const obs = parentObs || localObs;
  const isUsingParentObs = !!parentObs;

  // BroadcastChannel ref
  const channelRef = useRef<BroadcastChannel | null>(null);

  const trans = translations[currentLang] || translations.en;

  const obsRef = useRef(obs);
  const propsRef = useRef({ propTeamNameA, propTeamNameB });
  const transRef = useRef(trans);
  const triggerToastRef = useRef(triggerToast);
  obsRef.current = obs;
  propsRef.current = { propTeamNameA, propTeamNameB };
  transRef.current = trans;
  triggerToastRef.current = triggerToast;

  // --- Initialize BroadcastChannel & OBS connection ---
  useEffect(() => {
    channelRef.current = new BroadcastChannel('penalty_channel');
    let isMounted = true;
    // Listen for team name updates from main controller (only if not using parent OBS)
    const handleStorageChange = () => {
      if (!propsRef.current.propTeamNameA && !propsRef.current.propTeamNameB) {
        const nameA = localStorage.getItem('penalty_teamA');
        const nameB = localStorage.getItem('penalty_teamB');
        if (nameA) setTeamNameA(nameA);
        if (nameB) setTeamNameB(nameB);
      }
    };

    // Only listen to storage if not using parent props
    if (!isUsingParentObs) {
      window.addEventListener('storage', handleStorageChange);
      handleStorageChange();
    }

    // Connect to OBS only if not using parent's connection
    if (!isUsingParentObs) {
      const connectToObs = async () => {
        try {
          const connected = await obsRef.current.connect('ws://localhost:4455');
          if (!connected || !isMounted) return;

          console.log('[Penalty OBS] Connected for score synchronization');
          triggerToastRef.current(transRef.current.toastObsSuccess, 'success');

        } catch (err) {
          console.error('[Penalty OBS] Connection error:', err);
          if (isMounted) {
            triggerToastRef.current(transRef.current.toastObsError, 'error');
          }
        }
      };

      connectToObs();
    } else {
      console.log('[Penalty Modal] Using parent OBS connection');
    }

    return () => {
      isMounted = false;
      if (!isUsingParentObs) {
        window.removeEventListener('storage', handleStorageChange);
      }
      channelRef.current?.close();
    };
  }, [isUsingParentObs]);

  const updateOBSScore = (team: 'A' | 'B', val: number) => {
    const sourceName = team === 'A' ? 'Score_A' : 'Score_B';
    obs.setText(sourceName, String(val));
  };

  const broadcastUpdate = useCallback((currentShots = shots, currentSettings = settings) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'update',
        data: {
          shotsA: getShotsForPage('A', currentPage, currentShots),
          shotsB: getShotsForPage('B', currentPage, currentShots),
          settings: currentSettings
        }
      });
    }
  }, [currentPage, settings, shots]);

  // Sync state to BroadcastChannel when state changes
  useEffect(() => {
    broadcastUpdate();
  }, [broadcastUpdate]);

  // --- Penalty Control Actions ---
  const handleShoot = (team: 'A' | 'B', isGoal: boolean) => {
    // Broadcast button event
    try {
      const channel = new BroadcastChannel('button-events');
      channel.postMessage({
        type: 'ButtonClicked',
        buttonId: team === 'A' ? 'penalty_A' : 'penalty_B',
        team: team,
        isGoal: isGoal,
        timestamp: Date.now()
      });
      channel.close();
      console.log(`[PenaltyEvent] Broadcasted: penalty_${team}, isGoal: ${isGoal}`);
    } catch (e) {
      console.error('[PenaltyEvent] Failed to broadcast:', e);
    }

    const pageShots = shots[team][currentPage] || [];
    const isStartingNewPage = pageShots.length === 5;

    let nextShots = { ...shots };
    let nextCurrentPage = currentPage;

    if (isStartingNewPage) {
      nextCurrentPage = currentPage + 1;
      setCurrentPage(nextCurrentPage);
      if (!nextShots.A[nextCurrentPage]) nextShots.A.push([]);
      if (!nextShots.B[nextCurrentPage]) nextShots.B.push([]);
    }

    nextShots[team][nextCurrentPage].push(isGoal);
    setShots(nextShots);

    if (isGoal) {
      const nextScores = { ...scores, [team]: scores[team] + 1 };
      setScores(nextScores);
      updateOBSScore(team, nextScores[team]);
    }
  };

  const handleUndo = (team: 'A' | 'B') => {
    const pageShots = shots[team][currentPage] || [];
    let nextShots = { ...shots };
    let nextCurrentPage = currentPage;

    if (pageShots.length === 0) {
      if (currentPage > 0) {
        nextCurrentPage = currentPage - 1;
        setCurrentPage(nextCurrentPage);
      } else {
        return;
      }
    }

    const lastShot = nextShots[team][nextCurrentPage].pop();
    setShots(nextShots);

    if (lastShot === true) {
      const nextScores = { ...scores, [team]: Math.max(0, scores[team] - 1) };
      setScores(nextScores);
      updateOBSScore(team, nextScores[team]);
    }
  };

  const handleReset = () => {
    const confirmReset = window.confirm('รีเซ็ตข้อมูลทั้งหมดแน่ใจหรือไม่?');
    if (!confirmReset) return;

    const nextShots = { A: [[]], B: [[]] } as PenaltyShots;
    const nextScores = { A: 0, B: 0 };
    setShots(nextShots);
    setScores(nextScores);
    setCurrentPage(0);
    updateOBSScore('A', 0);
    updateOBSScore('B', 0);
  };

  const renderDotsPreview = (team: 'A' | 'B') => {
    const list = getShotsForPage(team, currentPage, shots);
    return (
      <div className="dots" style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '12px 0' }}>
        {list.map((shot, idx) => {
          let bg = 'transparent';
          let border = '2px solid #555';
          if (shot === true) { bg = '#10b981'; border = '2px solid #10b981'; }
          else if (shot === false) { bg = '#ef4444'; border = '2px solid #ef4444'; }
          return (
            <div key={idx} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: bg, border,
              boxShadow: shot !== null ? '0 0 10px rgba(0,0,0,0.5)' : 'none',
              opacity: shot !== null ? 1 : 0.4
            }} />
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0e1117', padding: '24px', alignItems: 'center' }}>
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
            {t.message}
          </div>
        ))}
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '650px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--accent-color)', fontSize: '1.6rem', marginBottom: '24px', fontWeight: 800 }}>
          ยิงจุดโทษ / Penalty Shootout
        </h2>

        {/* Panel row for team info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div className="team-row">
            <h3 style={{ fontSize: '1.25rem', margin: 0, wordBreak: 'break-word', textAlign: 'center' }}>{teamNameA}</h3>
            {renderDotsPreview('A')}
            <div className="score-display">{scores.A}</div>
          </div>
          <div className="team-row">
            <h3 style={{ fontSize: '1.25rem', margin: 0, wordBreak: 'break-word', textAlign: 'center' }}>{teamNameB}</h3>
            {renderDotsPreview('B')}
            <div className="score-display">{scores.B}</div>
          </div>
        </div>

        {/* Control buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-success" style={{ padding: '12px' }} onClick={() => handleShoot('A', true)}>
              <i className="fas fa-futbol"></i> เข้า (Goal A)
            </button>
            <button className="btn-danger" style={{ padding: '12px' }} onClick={() => handleShoot('A', false)}>
              <i className="fas fa-times"></i> ไม่เข้า (Miss A)
            </button>
            <button className="btn-secondary" style={{ padding: '10px' }} onClick={() => handleUndo('A')}>
              <i className="fas fa-undo"></i> ย้อนกลับ A
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-success" style={{ padding: '12px' }} onClick={() => handleShoot('B', true)}>
              <i className="fas fa-futbol"></i> เข้า (Goal B)
            </button>
            <button className="btn-danger" style={{ padding: '12px' }} onClick={() => handleShoot('B', false)}>
              <i className="fas fa-times"></i> ไม่เข้า (Miss B)
            </button>
            <button className="btn-secondary" style={{ padding: '10px' }} onClick={() => handleUndo('B')}>
              <i className="fas fa-undo"></i> ย้อนกลับ B
            </button>
          </div>
        </div>

        {/* Action Panel */}
        <div className="row center" style={{ gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button className="btn-danger" onClick={handleReset}>
            <i className="fas fa-redo"></i> รีเซ็ต
          </button>
          <button className="btn-secondary" onClick={() => setShowSettingsModal(true)}>
            <i className="fas fa-cog"></i> ตั้งค่าจุด
          </button>
          <button className="btn-secondary" onClick={() => setShowHelpModal(true)}>
            <i className="fas fa-question-circle"></i> ช่วยเหลือ
          </button>
          <button className="btn-secondary" onClick={() => window.open('/dots', '_blank')}>
            <i className="fas fa-circle"></i> เปิด Dots Overlay
          </button>
        </div>

      </div>


      {/* --- Dots Settings Modal --- */}
      {showSettingsModal && (
        <ModalBackdrop className="modal-overlay" onEscape={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ModalCloseButton onClose={() => setShowSettingsModal(false)} />
            <h3><i className="fas fa-cog"></i> ตั้งค่าจุดยิงจุดโทษ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ขนาดจุด (พิกเซล):</label>
                <input type="number" min="10" max="1000" value={settings.dotSize}
                  onChange={(e) => setSettings({ ...settings, dotSize: parseInt(e.target.value, 10) || 20 })}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ระยะห่างระหว่างจุด (พิกเซล):</label>
                <input type="number" min="0" max="1000" value={settings.dotGap}
                  onChange={(e) => setSettings({ ...settings, dotGap: parseInt(e.target.value, 10) || 8 })}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ระยะห่างระหว่างกลุ่มทีม (พิกเซล):</label>
                <input type="number" min="0" max="2000" value={settings.teamGap}
                  onChange={(e) => setSettings({ ...settings, teamGap: parseInt(e.target.value, 10) || 80 })}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>การจัดวาง (Layout):</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label>
                    <input type="radio" name="layout" value="side-by-side"
                      checked={settings.layout === 'side-by-side'}
                      onChange={() => setSettings({ ...settings, layout: 'side-by-side' })} />
                    {' '}ซ้าย-ขวา
                  </label>
                  <label>
                    <input type="radio" name="layout" value="top-bottom"
                      checked={settings.layout === 'top-bottom'}
                      onChange={() => setSettings({ ...settings, layout: 'top-bottom' })} />
                    {' '}บน-ล่าง
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => {
                localStorage.setItem('penalty_settings', JSON.stringify(settings));
                setShowSettingsModal(false);
                triggerToast(trans.toastSaved, 'success');
              }}>บันทึก</button>
              <button className="btn-secondary" onClick={() => setShowSettingsModal(false)}>ปิด</button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* --- Help Modal --- */}
      {showHelpModal && (
        <ModalBackdrop className="modal-overlay" onEscape={() => setShowHelpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ModalCloseButton onClose={() => setShowHelpModal(false)} />
            <h3><i className="fas fa-question-circle"></i> วิธีตั้งค่าใน OBS Studio</h3>
            <div style={{ fontSize: '0.95rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p>เพิ่ม Source เหล่านี้ใน OBS เพื่อให้คะแนนและกราฟิกแสดงผลได้:</p>
              <ol style={{ paddingLeft: '20px' }}>
                <li>
                  <strong>จุดยิงจุดโทษ (Dots Overlay)</strong>: เพิ่ม Browser Source ใน OBS โดยตั้ง URL เป็น:
                  <code style={{ display: 'block', background: '#111', padding: '6px', borderRadius: '4px', margin: '4px 0', wordBreak: 'break-all' }}>
                    {window.location.origin}/dots
                  </code>
                   แล้วตั้งชื่อ Source ตามที่คุณกำหนดไว้
                </li>
                <li>
                  <strong>ควบคุม OBS</strong>: ตั้งค่า Action แบบแสดงหรือซ่อน Source ผ่าน Macro ตาม workflow ที่ต้องการ
                </li>
              </ol>
              <p style={{ marginTop: '12px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                <strong>💡 เคล็ดลับ:</strong> หน้านี้จัดการผลการยิงและคะแนน ส่วนการควบคุม Source ให้จัดการผ่าน Macro
              </p>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setShowHelpModal(false)}>ตกลง</button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}
