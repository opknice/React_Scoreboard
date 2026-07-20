import { useState, useEffect } from 'react';
import type { Macro } from '../services/macroEngine';
import MacroBuilder from './MacroBuilder';
import AdvSceneSwitcherImporter from './AdvSceneSwitcherImporter';

interface MacroControlPanelProps {
  obs: any; // OBS WebSocket hook
  macroEngineRef: React.MutableRefObject<any>;
  macroEngineReady: boolean;
  obsEventLogs: { eventType: string; data: any; time: string }[];
  onClearEventLogs: () => void;
  macroLogs: { message: string; level: string; time: string }[];
  onClearMacroLogs: () => void;
}

export default function MacroControlPanel({ obs, macroEngineRef, macroEngineReady, obsEventLogs, onClearEventLogs, macroLogs, onClearMacroLogs }: MacroControlPanelProps) {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showOBSEvents, setShowOBSEvents] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingMacro, setEditingMacro] = useState<Macro | undefined>(undefined);
  const [showImporter, setShowImporter] = useState(false);
  const [availableScenes, setAvailableScenes] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [groupedSources, setGroupedSources] = useState<{ scenes: string[]; inputs: string[] }>({ scenes: [], inputs: [] });
  const [sceneItems, setSceneItems] = useState<Array<{ label: string; sceneName: string; sourceName: string; sceneItemId: number; visible: boolean }>>([]);

  // Sync macros from MacroEngine when it's ready or when modal opens
  useEffect(() => {
    if (!macroEngineReady || !macroEngineRef.current) return;
    
    // Load current macros from engine
    setMacros(macroEngineRef.current.getMacros());
    
    // Load scenes and sources from OBS
    loadOBSData();
  }, [macroEngineReady]);

  const loadOBSData = async () => {
    if (!macroEngineRef.current) return;
    
    try {
      const scenes = await macroEngineRef.current.getAvailableScenes();
      const sources = await macroEngineRef.current.getAvailableSources();
      const grouped = await macroEngineRef.current.getAvailableSourcesGrouped();
      const itemsData = await macroEngineRef.current.getSceneItemsDetailed();
      
      setAvailableScenes(scenes);
      setAvailableSources(sources);
      setGroupedSources(grouped);
      setSceneItems(itemsData.sceneItems);
      
      console.log('Loaded from OBS:', { 
        scenes: scenes.length, 
        sources: sources.length,
        grouped: { scenes: grouped.scenes.length, inputs: grouped.inputs.length },
        sceneItems: itemsData.sceneItems.length
      });
    } catch (error) {
      console.error('Failed to load OBS data:', error);
    }
  };

  // Save macros to localStorage whenever they change
  const saveMacrosToLocalStorage = (updatedMacros: Macro[]) => {
    try {
      localStorage.setItem('customMacros', JSON.stringify(updatedMacros));
    } catch (error) {
      console.error('Failed to save macros to localStorage:', error);
    }
  };

  const handleTriggerMacro = async (macroId: string) => {
    if (!macroEngineRef.current) {
      alert('Macro Engine not initialized');
      return;
    }

    try {
      await macroEngineRef.current.triggerMacro(macroId);
    } catch (error: any) {
      console.error('Macro error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleToggleMacro = (macroId: string) => {
    if (!macroEngineRef.current) return;

    const macro = macroEngineRef.current.getMacro(macroId);
    if (!macro) return;

    macro.enabled = !macro.enabled;
    macroEngineRef.current.addMacro(macro);
    const updatedMacros = macroEngineRef.current.getMacros();
    setMacros(updatedMacros);
    saveMacrosToLocalStorage(updatedMacros);
  };

  const handleExportMacros = () => {
    if (!macroEngineRef.current) return;

    const json = macroEngineRef.current.exportMacros();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'macros-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportMacros = (importedMacros: Macro[]) => {
    if (!macroEngineRef.current) return;

    // Add all imported macros
    for (const macro of importedMacros) {
      macroEngineRef.current.addMacro(macro);
    }

    // Update state and save
    const updatedMacros = macroEngineRef.current.getMacros();
    setMacros(updatedMacros);
    saveMacrosToLocalStorage(updatedMacros);
    setShowImporter(false);

    // Show success message
    console.log(`Successfully imported ${importedMacros.length} macro(s)`);
  };

  const handleCreateMacro = () => {
    setEditingMacro(undefined);
    setShowBuilder(true);
  };

  const handleEditMacro = (macro: Macro) => {
    setEditingMacro(macro);
    setShowBuilder(true);
  };

  const handleSaveMacro = (macro: Macro) => {
    if (!macroEngineRef.current) return;

    macroEngineRef.current.addMacro(macro);
    const updatedMacros = macroEngineRef.current.getMacros();
    setMacros(updatedMacros);
    saveMacrosToLocalStorage(updatedMacros);
    setShowBuilder(false);
    setEditingMacro(undefined);
  };

  const handleCancelBuilder = () => {
    setShowBuilder(false);
    setEditingMacro(undefined);
  };

  const handleDeleteMacro = (macroId: string) => {
    if (!macroEngineRef.current) return;

    const macro = macroEngineRef.current.getMacro(macroId);
    if (!macro) return;

    if (window.confirm(`Delete macro "${macro.name}"?`)) {
      macroEngineRef.current.removeMacro(macroId);
      const updatedMacros = macroEngineRef.current.getMacros();
      setMacros(updatedMacros);
      saveMacrosToLocalStorage(updatedMacros);
    }
  };

  const handleDuplicateMacro = (macro: Macro) => {
    if (!macroEngineRef.current) return;

    const duplicated: Macro = {
      ...macro,
      id: `custom-${Date.now()}`,
      name: `${macro.name} (Copy)`,
      enabled: false
    };

    macroEngineRef.current.addMacro(duplicated);
    const updatedMacros = macroEngineRef.current.getMacros();
    setMacros(updatedMacros);
    saveMacrosToLocalStorage(updatedMacros);
  };

  // Get macro icon
  const getMacroIcon = (macro: Macro) => {
    if (macro.name.includes('Replay')) return '🎬';
    if (macro.name.includes('Goal')) return '⚽';
    if (macro.name.includes('Penalty')) return '🎯';
    if (macro.name.includes('Standings') || macro.name.includes('Table')) return '📊';
    if (macro.name.includes('Half')) return '⏸️';
    return '⚙️';
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-list"></i> Macros
          {macroEngineReady && (
            <span style={{ 
              fontSize: '0.7rem', 
              background: '#10b981', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontWeight: 'normal'
            }}>
              ENGINE RUNNING
            </span>
          )}
          {availableScenes.length > 0 && (
            <span style={{ 
              fontSize: '0.7rem', 
              background: '#3b82f6', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontWeight: 'normal'
            }}>
              {availableScenes.length} Scenes
            </span>
          )}
          {availableSources.length > 0 && (
            <span style={{ 
              fontSize: '0.7rem', 
              background: '#8b5cf6', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontWeight: 'normal'
            }}>
              {availableSources.length} Sources
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-success"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={handleCreateMacro}
            disabled={!obs.isConnected}
          >
            <i className="fas fa-plus"></i> Create Macro
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={loadOBSData}
            disabled={!obs.isConnected}
            title="Refresh scenes and sources from OBS"
          >
            <i className="fas fa-sync"></i> Refresh OBS Data
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={() => setShowLogs(!showLogs)}
          >
            <i className="fas fa-list"></i> {showLogs ? 'Hide' : 'Show'} Logs ({macroLogs.length})
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={() => setShowOBSEvents(!showOBSEvents)}
          >
            <i className="fas fa-broadcast-tower"></i> {showOBSEvents ? 'Hide' : 'Show'} OBS Events ({obsEventLogs.length})
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={() => setShowImporter(true)}
          >
            <i className="fas fa-file-import"></i> Import
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={handleExportMacros}
          >
            <i className="fas fa-download"></i> Export
          </button>
        </div>
      </div>

      {!obs.isConnected && (
        <div style={{
          padding: '16px',
          background: '#7c2d12',
          borderRadius: '8px',
          borderLeft: '4px solid #f97316',
          color: '#fbbf24',
          marginBottom: '16px'
        }}>
          <i className="fas fa-exclamation-triangle"></i> <strong>OBS not connected</strong><br />
          <span style={{ fontSize: '0.85rem' }}>Please connect to OBS WebSocket to use macros</span>
        </div>
      )}

      {/* Macro Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px',
        marginBottom: showLogs ? '16px' : '0'
      }}>
        {macros.map((macro) => (
          <div
            key={macro.id}
            style={{
              background: macro.enabled ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#18181b',
              border: macro.enabled ? '2px solid #3b82f6' : '2px solid #27272a',
              borderRadius: '12px',
              padding: '16px',
              opacity: macro.enabled ? 1 : 0.6,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                  {getMacroIcon(macro)}
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#e2e8f0' }}>
                  {macro.name.replace(/^[^a-zA-Z]+/, '')}
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                  {macro.description}
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={macro.enabled}
                  onChange={() => handleToggleMacro(macro.id)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: macro.enabled ? '#10b981' : '#4b5563',
                  borderRadius: '20px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '14px',
                    width: '14px',
                    left: macro.enabled ? '23px' : '3px',
                    bottom: '3px',
                    background: '#fff',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }}></span>
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                className="btn-primary"
                disabled={!macro.enabled || !obs.isConnected}
                onClick={() => handleTriggerMacro(macro.id)}
                style={{
                  flex: 1,
                  fontSize: '0.85rem',
                  padding: '8px 12px',
                  opacity: (!macro.enabled || !obs.isConnected) ? 0.5 : 1,
                  cursor: (!macro.enabled || !obs.isConnected) ? 'not-allowed' : 'pointer'
                }}
              >
                <i className="fas fa-play"></i> Run
              </button>
              
              {/* Show Edit/Delete buttons for custom macros */}
              {macro.id.startsWith('custom-') && (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => handleEditMacro(macro)}
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    title="Edit"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleDuplicateMacro(macro)}
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    title="Duplicate"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDeleteMacro(macro.id)}
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </>
              )}
              
              {/* Show Duplicate button for preset macros */}
              {!macro.id.startsWith('custom-') && (
                <button
                  className="btn-secondary"
                  onClick={() => handleDuplicateMacro(macro)}
                  style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                  title="Duplicate to customize"
                >
                  <i className="fas fa-copy"></i>
                </button>
              )}
              
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '8px'
              }}>
                {macro.actions.length} step{macro.actions.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Logs Section */}
      {showLogs && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#0f172a',
          borderRadius: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: '#cbd5e1' }}>
              <i className="fas fa-cogs"></i> Macro Execution Logs
            </strong>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={onClearMacroLogs}
            >
              <i className="fas fa-trash"></i> Clear
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
            {macroLogs.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>
                <i className="fas fa-history" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block', opacity: 0.3 }}></i>
                No logs yet. Run a macro or wait for auto-trigger.
              </div>
            ) : (
              macroLogs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '4px 8px',
                    marginBottom: '2px',
                    background: log.level === 'error' ? '#7f1d1d' : log.level === 'warn' ? '#78350f' : '#1e293b',
                    borderLeft: `3px solid ${log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#f59e0b' : '#3b82f6'}`,
                    borderRadius: '4px'
                  }}
                >
                  <span style={{ color: '#64748b' }}>[{log.time}]</span>{' '}
                  <span style={{ color: log.level === 'error' ? '#fca5a5' : log.level === 'warn' ? '#fcd34d' : '#cbd5e1' }}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* OBS Events Log Section */}
      {showOBSEvents && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#0f172a',
          borderRadius: '8px',
          maxHeight: '400px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: '#cbd5e1' }}>
              <i className="fas fa-broadcast-tower"></i> OBS Live Events Monitor
            </strong>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={onClearEventLogs}
            >
              <i className="fas fa-trash"></i> Clear
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
            {obsEventLogs.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>
                <i className="fas fa-satellite-dish" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block', opacity: 0.3 }}></i>
                Waiting for OBS events...<br />
                <span style={{ fontSize: '0.75rem' }}>
                  Try switching scenes, muting sources, starting recording, etc.
                </span>
              </div>
            ) : (
              obsEventLogs.map((log, idx) => {
                // Color coding based on event type
                let borderColor = '#3b82f6'; // Default blue
                let bgColor = '#1e293b';
                let icon = '📡';
                
                if (log.eventType.includes('Scene')) {
                  borderColor = '#8b5cf6'; // Purple for scenes
                  icon = '🎬';
                } else if (log.eventType.includes('Input') || log.eventType.includes('Source')) {
                  borderColor = '#10b981'; // Green for sources
                  icon = '📹';
                } else if (log.eventType.includes('Stream') || log.eventType.includes('Record')) {
                  borderColor = '#ef4444'; // Red for streaming/recording
                  icon = '🔴';
                } else if (log.eventType.includes('Filter')) {
                  borderColor = '#f59e0b'; // Orange for filters
                  icon = '🎨';
                } else if (log.eventType.includes('Replay')) {
                  borderColor = '#06b6d4'; // Cyan for replay buffer
                  icon = '⏪';
                } else if (log.eventType.includes('Transition')) {
                  borderColor = '#ec4899'; // Pink for transitions
                  icon = '🔄';
                }

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 10px',
                      marginBottom: '2px',
                      background: bgColor,
                      borderLeft: `3px solid ${borderColor}`,
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>[{log.time}]</span>{' '}
                        <span style={{ color: borderColor, fontWeight: 'bold' }}>
                          {icon} {log.eventType}
                        </span>
                      </div>
                    </div>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <div style={{ 
                        marginTop: '4px', 
                        paddingLeft: '16px',
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                        maxHeight: '100px',
                        overflowY: 'auto'
                      }}>
                        {Object.entries(log.data).map(([key, value]) => {
                          // Skip noisy fields
                          if (key === 'eventData' || key === 'eventIntent' || key === 'eventType') return null;
                          
                          // Format value
                          let displayValue = value;
                          if (typeof value === 'object' && value !== null) {
                            displayValue = JSON.stringify(value, null, 2);
                          } else if (typeof value === 'boolean') {
                            displayValue = value ? '✓' : '✗';
                          }
                          
                          return (
                            <div key={key} style={{ marginBottom: '2px' }}>
                              <span style={{ color: '#64748b' }}>{key}:</span>{' '}
                              <span style={{ color: '#cbd5e1' }}>{String(displayValue)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: '#064e3b',
        borderRadius: '6px',
        borderLeft: '4px solid #10b981',
        fontSize: '0.85rem',
        color: '#a7f3d0'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <i className="fas fa-info-circle" style={{ marginTop: '2px', color: '#10b981' }}></i>
          <div>
            <strong style={{ color: '#6ee7b7' }}>💡 วิธีใช้งาน:</strong><br />
            • เปิด/ปิด macro ด้วย toggle switch<br />
            • คลิก "Run" เพื่อรัน macro ทันที<br />
            • คลิก <i className="fas fa-edit"></i> เพื่อแก้ไข custom macro<br />
            • คลิก <i className="fas fa-copy"></i> เพื่อ duplicate และปรับแต่ง<br />
            • คลิก "Create Macro" เพื่อสร้าง macro ใหม่<br />
            • คลิก "Import" เพื่อนำเข้า macros จาก Advanced Scene Switcher<br />
            • ดู logs เพื่อติดตามการทำงาน
          </div>
        </div>
      </div>

      {/* Macro Builder Modal */}
      {showBuilder && (
        <MacroBuilder
          macro={editingMacro}
          onSave={handleSaveMacro}
          onCancel={handleCancelBuilder}
          availableScenes={availableScenes.length > 0 ? availableScenes : ['Main Stream', 'Replay']}
          availableSources={availableSources.length > 0 ? availableSources : ['Main_events', 'Penalty', 'Goal_Alert', 'Standings']}
          groupedSources={groupedSources}
          sceneItems={sceneItems}
        />
      )}

      {/* Advanced Scene Switcher Importer Modal */}
      {showImporter && (
        <AdvSceneSwitcherImporter
          onImport={handleImportMacros}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
