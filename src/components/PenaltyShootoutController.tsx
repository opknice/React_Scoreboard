import { useState, useEffect, useRef } from 'react';
import { translations } from '../constants/translations';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';

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

interface OBSSceneSettings {
  sceneName: string;
  showSources: string;    // comma-separated
  hideSources: string;    // comma-separated
  closeShowSources: string; // comma-separated — sources to SHOW when closing
}

interface PenaltyShootoutControllerProps {
  obs?: any; // OBS connection from parent
  teamNameA?: string; // Team A name from parent
  teamNameB?: string; // Team B name from parent
  onClose?: () => void; // Callback when closing
}

const DEFAULT_OBS_SCENE: OBSSceneSettings = {
  sceneName: 'Main Stream',
  showSources: 'Penalty',
  hideSources: 'Main_events,Standings,Goal_Alert',
  closeShowSources: 'Main_events',
};

export default function PenaltyShootoutController({ obs: parentObs, teamNameA: propTeamNameA, teamNameB: propTeamNameB, onClose: _onClose }: PenaltyShootoutControllerProps = {}) {
  // --- States ---
  const [currentLang, setCurrentLang] = useState<string>(() => localStorage.getItem('penalty_language') || 'th');
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
      : { dotSize: 30, dotGap: 12, teamGap: 80, layout: 'side-by-side' };
  });

  // OBS Scene Toggle Settings
  const [obsSceneSettings, setObsSceneSettings] = useState<OBSSceneSettings>(() => {
    const saved = localStorage.getItem('penalty_obs_scene');
    return saved ? JSON.parse(saved) : DEFAULT_OBS_SCENE;
  });

  // Modal Visibility
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSceneSettingsModal, setShowSceneSettingsModal] = useState<boolean>(false);
  const [editSceneSettings, setEditSceneSettings] = useState<OBSSceneSettings>(obsSceneSettings);

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

  // Ref to track latest OBS connection state in cleanup (avoids stale closure)
  const obsIsConnectedRef = useRef(false);

  const trans = translations[currentLang] || translations.en;
  // Keep ref in sync so cleanup function can read latest connection state
  obsIsConnectedRef.current = obs.isConnected;

  // --- Initialize BroadcastChannel & OBS connection ---
  useEffect(() => {
    channelRef.current = new BroadcastChannel('penalty_channel');
    let isMounted = true;

    // Listen for team name updates from main controller (only if not using parent OBS)
    const handleStorageChange = () => {
      if (!propTeamNameA && !propTeamNameB) {
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
      const connectAndShowPenalty = async () => {
        try {
          const connected = await obs.connect('ws://localhost:4455');
          if (!connected || !isMounted) return;
          
          console.log('[Penalty OBS] Connected, showing penalty overlay...');
          triggerToast(trans.toastObsSuccess, 'success');
          
          // Wait a bit for OBS connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Auto-show penalty overlay on open
          await toggleSources(
            obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
            obsSceneSettings.hideSources.split(',').map((s) => s.trim()).filter(Boolean),
            true // force = true to bypass connection check
          );
          console.log('[Penalty OBS] Penalty overlay shown');
        } catch (err) {
          console.error('[Penalty OBS] Connection error:', err);
          if (isMounted) {
            triggerToast(trans.toastObsError, 'error');
          }
        }
      };

      connectAndShowPenalty();
    } else {
      console.log('[Penalty Modal] Using parent OBS connection');
    }

    // Handle visibility change - when tab is hidden or closed
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && obsIsConnectedRef.current && !isUsingParentObs) {
        console.log('[Penalty OBS] Page hidden (visibilitychange), hiding penalty overlay...');
        try {
          await toggleSources(
            obsSceneSettings.closeShowSources.split(',').map((s) => s.trim()).filter(Boolean),
            obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
            true
          );
          console.log('[Penalty OBS] Penalty overlay hidden on visibility change');
        } catch (err) {
          console.error('[Penalty OBS] Error hiding on visibility change:', err);
        }
      }
    };

    // Handle page hide - specifically for OBS dock close
    const handlePageHide = async () => {
      if (obsIsConnectedRef.current && !isUsingParentObs) {
        console.log('[Penalty OBS] Page hiding (pagehide), hiding penalty overlay...');
        try {
          await toggleSources(
            obsSceneSettings.closeShowSources.split(',').map((s) => s.trim()).filter(Boolean),
            obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
            true
          );
          console.log('[Penalty OBS] Penalty overlay hidden on pagehide');
        } catch (err) {
          console.error('[Penalty OBS] Error hiding on pagehide:', err);
        }
      }
    };

    // Handle beforeunload as last resort
    const handleBeforeUnload = () => {
      if (obsIsConnectedRef.current && !isUsingParentObs) {
        console.log('[Penalty OBS] Page unloading (beforeunload), attempting cleanup...');
        // Synchronous call - may not complete but worth trying
        const hideList = obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean);
        const showList = obsSceneSettings.closeShowSources.split(',').map((s) => s.trim()).filter(Boolean);
        
        // Attempt cleanup
        toggleSources(showList, hideList, true).catch(err => {
          console.error('[Penalty OBS] Beforeunload cleanup error:', err);
        });
      }
    };

    if (!isUsingParentObs) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      isMounted = false;
      if (!isUsingParentObs) {
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      channelRef.current?.close();
      
      // Mark that we're cleaning up
      const shouldCleanup = obsIsConnectedRef.current;
      
      // Cleanup for component unmount - but keep connection alive if using parent
      if (shouldCleanup && !isUsingParentObs) {
        console.log('[Penalty OBS] Component unmounting, hiding penalty overlay...');
        toggleSources(
          obsSceneSettings.closeShowSources.split(',').map((s) => s.trim()).filter(Boolean),
          obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
          true
        ).then(() => {
          console.log('[Penalty OBS] Penalty overlay hidden on unmount');
        }).catch(err => {
          console.error('[Penalty OBS] Cleanup error:', err);
        });
      }
    };
  }, [isUsingParentObs]);

  // Sync state to BroadcastChannel when state changes
  useEffect(() => {
    broadcastUpdate();
  }, [shots, currentPage, settings]);

  // --- OBS Scene Source Toggle ---
  const toggleSources = async (showList: string[], hideList: string[], force = false) => {
    // Allow force bypass for timing issues after connect
    if (!force && !obs.isConnected) {
      console.warn('[Penalty OBS] toggleSources called but OBS not connected');
      triggerToast('ไม่ได้เชื่อมต่อกับ OBS', 'error');
      return;
    }
    const sceneName = obsSceneSettings.sceneName;
    console.log(`[Penalty OBS] toggleSources - Scene: ${sceneName}, Show: [${showList.join(', ')}], Hide: [${hideList.join(', ')}]`);

    try {
      for (const sourceName of showList) {
        if (!sourceName) continue;
        const id = await obs.getSceneItemId(sceneName, sourceName);
        if (id !== null) {
          await obs.setSceneItemEnabled(sceneName, id, true);
          console.log(`[Penalty OBS] ✓ SHOW: ${sourceName} (id=${id})`);
        } else {
          console.warn(`[Penalty OBS] ⚠ Cannot find source "${sourceName}" in scene "${sceneName}"`);
        }
      }
      for (const sourceName of hideList) {
        if (!sourceName) continue;
        const id = await obs.getSceneItemId(sceneName, sourceName);
        if (id !== null) {
          await obs.setSceneItemEnabled(sceneName, id, false);
          console.log(`[Penalty OBS] ✓ HIDE: ${sourceName} (id=${id})`);
        } else {
          console.warn(`[Penalty OBS] ⚠ Cannot find source "${sourceName}" in scene "${sceneName}"`);
        }
      }
    } catch (err) {
      console.error('[Penalty OBS] Error in toggleSources:', err);
      throw err; // Re-throw so caller can handle
    }
  };

  const updateOBSScore = (team: 'A' | 'B', val: number) => {
    const sourceName = team === 'A' ? 'Score_A' : 'Score_B';
    obs.setText(sourceName, String(val));
  };

  const getShotsForCurrentPage = (team: 'A' | 'B', currentShots = shots) => {
    const pageShots = currentShots[team][currentPage] || [];
    const displayArray = Array(5).fill(null);
    for (let i = 0; i < pageShots.length; i++) {
      displayArray[i] = pageShots[i];
    }
    return displayArray;
  };

  const broadcastUpdate = (currentShots = shots, currentSettings = settings) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'update',
        data: {
          shotsA: getShotsForCurrentPage('A', currentShots),
          shotsB: getShotsForCurrentPage('B', currentShots),
          settings: currentSettings
        }
      });
    }
  };

  const handleHidePenalty = async () => {
    console.log('[Penalty OBS] Hide button clicked, hiding penalty overlay...');
    
    // Check if OBS is actually connected, if not try to reconnect
    if (!obsIsConnectedRef.current || !obs.isConnected) {
      console.warn('[Penalty OBS] OBS not connected, attempting to reconnect...');
      try {
        await obs.connect('ws://localhost:4455');
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error('[Penalty OBS] Failed to reconnect:', err);
        triggerToast('ไม่สามารถเชื่อมต่อกับ OBS ได้', 'error');
        return;
      }
    }
    
    try {
      await toggleSources(
        obsSceneSettings.closeShowSources.split(',').map((s) => s.trim()).filter(Boolean),
        obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
        true
      );
      console.log('[Penalty OBS] Penalty overlay hidden successfully');
      triggerToast('ซ่อนจุดโทษเรียบร้อย', 'success');
    } catch (err) {
      console.error('[Penalty OBS] Error hiding penalty:', err);
      triggerToast('เกิดข้อผิดพลาดในการซ่อนจุดโทษ', 'error');
    }
  };

  const handleShowPenalty = async () => {
    console.log('[Penalty OBS] Show button clicked, showing penalty overlay...');
    
    // Check if OBS is actually connected, if not try to reconnect
    if (!obsIsConnectedRef.current || !obs.isConnected) {
      console.warn('[Penalty OBS] OBS not connected, attempting to reconnect...');
      try {
        await obs.connect('ws://localhost:4455');
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error('[Penalty OBS] Failed to reconnect:', err);
        triggerToast('ไม่สามารถเชื่อมต่อกับ OBS ได้', 'error');
        return;
      }
    }
    
    try {
      await toggleSources(
        obsSceneSettings.showSources.split(',').map((s) => s.trim()).filter(Boolean),
        obsSceneSettings.hideSources.split(',').map((s) => s.trim()).filter(Boolean),
        true
      );
      console.log('[Penalty OBS] Penalty overlay shown successfully');
      triggerToast('แสดงจุดโทษเรียบร้อย', 'success');
    } catch (err) {
      console.error('[Penalty OBS] Error showing penalty:', err);
      triggerToast('เกิดข้อผิดพลาดในการแสดงจุดโทษ', 'error');
    }
  };

  // --- Penalty Control Actions ---
  const handleShoot = (team: 'A' | 'B', isGoal: boolean) => {
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
    const list = getShotsForCurrentPage(team);
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
          <button 
            className="btn-success" 
            onClick={handleShowPenalty}
            style={{ 
              padding: '12px 20px',
              fontSize: '1.05rem',
              fontWeight: 600
            }}
          >
            <i className="fas fa-eye"></i> แสดงจุดโทษ
          </button>
          <button 
            className="btn-danger" 
            onClick={handleHidePenalty}
            style={{ 
              padding: '12px 20px',
              fontSize: '1.05rem',
              fontWeight: 600
            }}
          >
            <i className="fas fa-eye-slash"></i> ซ่อนจุดโทษ
          </button>
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

        {/* Status Indicator - Manual control */}
        {obs.isConnected && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '16px', 
            padding: '10px', 
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: '#3b82f6'
          }}>
            <i className="fas fa-info-circle"></i> จุดโทษแสดงอัตโนมัติเมื่อเปิดหน้านี้
            <div style={{ fontSize: '0.8rem', marginTop: '4px', color: '#94a3b8' }}>
              ใช้ปุ่ม "แสดง/ซ่อนจุดโทษ" ด้านบนเพื่อควบคุม
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <select
            value={currentLang}
            onChange={(e) => {
              setCurrentLang(e.target.value);
              localStorage.setItem('penalty_language', e.target.value);
            }}
            style={{ padding: '6px 12px', background: '#232730', borderColor: '#3a3a3a', color: '#fff' }}
          >
            <option value="th">ภาษาไทย</option>
            <option value="en">English</option>
            <option value="ko">한국어</option>
            <option value="lo">ພາສາລາວ</option>
            <option value="km">ភាសាខ្មែរ</option>
            <option value="pt-br">Português (BR)</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: '20px', color: 'var(--text-muted-color)', fontSize: '0.85rem', textAlign: 'center' }}>
        OBS Dock UI – Penalty Shootout Controller V2.0<br />
        <span style={{ color: obs.isConnected ? '#10b981' : '#ef4444' }}>
          {obs.isConnected ? '● Connected to OBS WebSocket' : '○ Disconnected from OBS'}
        </span>
        {obs.isConnected && (
          <span style={{ marginLeft: '12px', color: '#6d28d9' }}>
            Scene: <strong>{obsSceneSettings.sceneName}</strong>
          </span>
        )}
      </div>

      {/* --- Dots Settings Modal --- */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3><i className="fas fa-cog"></i> ตั้งค่าจุดยิงจุดโทษ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ขนาดจุด (พิกเซล):</label>
                <input type="number" min="10" max="100" value={settings.dotSize}
                  onChange={(e) => setSettings({ ...settings, dotSize: parseInt(e.target.value, 10) || 20 })}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ระยะห่างระหว่างจุด (พิกเซล):</label>
                <input type="number" min="0" max="100" value={settings.dotGap}
                  onChange={(e) => setSettings({ ...settings, dotGap: parseInt(e.target.value, 10) || 8 })}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>ระยะห่างระหว่างกลุ่มทีม (พิกเซล):</label>
                <input type="number" min="0" max="200" value={settings.teamGap}
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
        </div>
      )}

      {/* --- OBS Scene Source Toggle Settings Modal --- */}
      {showSceneSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSceneSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3><i className="fas fa-tv"></i> ตั้งค่า OBS Scene Toggle</h3>
            <p style={{ color: 'var(--text-muted-color)', fontSize: '0.85rem', marginBottom: '16px' }}>
              ตั้งค่า Source ที่จะ Show/Hide เมื่อเปิดหน้าจอยิงจุดโทษ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Scene Name:
                </label>
                <input type="text" style={{ width: '100%' }}
                  value={editSceneSettings.sceneName}
                  onChange={(e) => setEditSceneSettings({ ...editSceneSettings, sceneName: e.target.value })}
                  placeholder="Main Stream" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  <span style={{ color: '#10b981' }}>● SHOW</span> เมื่อเปิดหน้านี้ (คั่นด้วยจุลภาค):
                </label>
                <input type="text" style={{ width: '100%' }}
                  value={editSceneSettings.showSources}
                  onChange={(e) => setEditSceneSettings({ ...editSceneSettings, showSources: e.target.value })}
                  placeholder="Penalty" />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-color)', margin: '4px 0 0 0' }}>
                  ตัวอย่าง: <code>Penalty</code>
                </p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  <span style={{ color: '#ef4444' }}>● HIDE</span> เมื่อเปิดหน้านี้ (คั่นด้วยจุลภาค):
                </label>
                <input type="text" style={{ width: '100%' }}
                  value={editSceneSettings.hideSources}
                  onChange={(e) => setEditSceneSettings({ ...editSceneSettings, hideSources: e.target.value })}
                  placeholder="Main_events,Standings,Goal_Alert" />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-color)', margin: '4px 0 0 0' }}>
                  ตัวอย่าง: <code>Main_events,Standings,Goal_Alert</code>
                </p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  <span style={{ color: '#10b981' }}>● SHOW กลับ</span> เมื่อปิดหน้านี้ (คั่นด้วยจุลภาค):
                </label>
                <input type="text" style={{ width: '100%' }}
                  value={editSceneSettings.closeShowSources}
                  onChange={(e) => setEditSceneSettings({ ...editSceneSettings, closeShowSources: e.target.value })}
                  placeholder="Main_events" />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => {
                setObsSceneSettings(editSceneSettings);
                localStorage.setItem('penalty_obs_scene', JSON.stringify(editSceneSettings));
                setShowSceneSettingsModal(false);
                triggerToast(trans.toastSaved, 'success');
              }}>
                <i className="fas fa-save"></i> บันทึก
              </button>
              <button className="btn-secondary" onClick={() => {
                setEditSceneSettings(DEFAULT_OBS_SCENE);
              }}>
                รีเซ็ต
              </button>
              <button className="btn-secondary" onClick={() => setShowSceneSettingsModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Help Modal --- */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3><i className="fas fa-question-circle"></i> วิธีตั้งค่าใน OBS Studio</h3>
            <div style={{ fontSize: '0.95rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p>เพิ่ม Source เหล่านี้ใน OBS เพื่อให้คะแนนและกราฟิกแสดงผลได้:</p>
              <ol style={{ paddingLeft: '20px' }}>
                <li>
                  <strong>จุดยิงจุดโทษ (Dots Overlay)</strong>: เพิ่ม Browser Source ใน OBS โดยตั้ง URL เป็น:
                  <code style={{ display: 'block', background: '#111', padding: '6px', borderRadius: '4px', margin: '4px 0', wordBreak: 'break-all' }}>
                    {window.location.origin}/dots
                  </code>
                  แล้วตั้งชื่อ source เป็น <code>Penalty</code> หรือตามที่คุณกำหนดไว้
                </li>
                <li>
                  <strong>การแสดง/ซ่อนจุดโทษ</strong>: คลิกปุ่ม <em>"แสดงจุดโทษ"</em> หรือ <em>"ซ่อนจุดโทษ"</em> ใหญ่ ๆ ด้านบน
                  ระบบจะสลับสถานะอัตโนมัติให้
                </li>
                <li>
                  <strong>ตั้งค่าขั้นสูง</strong>: หากต้องการปรับ source name หรือ scene name ให้เข้าไปตั้งค่าใน 
                  localStorage ด้วย key: <code>penalty_obs_scene</code>
                </li>
              </ol>
              <p style={{ marginTop: '12px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                <strong>💡 เคล็ดลับ:</strong> ระบบจะแสดงจุดโทษอัตโนมัติเมื่อเปิดหน้านี้ และซ่อนอัตโนมัติเมื่อปิดหน้า
              </p>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setShowHelpModal(false)}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
