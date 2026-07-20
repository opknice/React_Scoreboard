import { useState } from 'react';
import type { Macro, MacroAction, MacroActionType, MacroCondition, MacroConditionType } from '../services/macroEngine';

interface MacroBuilderProps {
  macro?: Macro; // For editing existing macro
  onSave: (macro: Macro) => void;
  onCancel: () => void;
  availableScenes?: string[];
  availableSources?: string[];
  groupedSources?: { scenes: string[]; inputs: string[] };
  sceneItems?: Array<{ label: string; sceneName: string; sourceName: string; sceneItemId: number; visible: boolean }>;
}

export default function MacroBuilder({ 
  macro, 
  onSave, 
  onCancel,
  availableScenes = ['Main Stream', 'Replay'],
  availableSources = ['Main_events', 'Penalty', 'Goal_Alert', 'Standings'],
  groupedSources = { scenes: [], inputs: [] },
  sceneItems = []
}: MacroBuilderProps) {
  const [name, setName] = useState(macro?.name || '');
  const [description, setDescription] = useState(macro?.description || '');
  const [enabled, setEnabled] = useState(macro?.enabled ?? true);
  const [runOnce, setRunOnce] = useState(macro?.runOnce ?? false);
  const [parallel, setParallel] = useState(macro?.parallel ?? false);
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(macro?.conditionLogic || 'AND');
  const [conditions, setConditions] = useState<MacroCondition[]>(macro?.conditions || [{ type: 'manual' }]);
  const [actions, setActions] = useState<MacroAction[]>(macro?.actions || []);
  const [elseActions, setElseActions] = useState<MacroAction[]>(macro?.elseActions || []);
  const [showElseActions, setShowElseActions] = useState((macro?.elseActions?.length || 0) > 0);

  const actionTypes: { value: MacroActionType; label: string; icon: string }[] = [
    { value: 'wait', label: 'Wait', icon: '⏱️' },
    { value: 'scene_switch', label: 'Switch Scene', icon: '🎬' },
    { value: 'source_show', label: 'Show Source', icon: '👁️' },
    { value: 'source_hide', label: 'Hide Source', icon: '🙈' },
    { value: 'source_mute', label: 'Mute Audio Source', icon: '🔇' },
    { value: 'source_unmute', label: 'Unmute Audio Source', icon: '🔊' },
    { value: 'source_volume', label: 'Set Volume', icon: '🎚️' },
    { value: 'filter_enable', label: 'Enable Filter', icon: '🎨' },
    { value: 'filter_disable', label: 'Disable Filter', icon: '⛔' },
    { value: 'hotkey', label: 'Trigger Hotkey', icon: '⌨️' },
    { value: 'start_streaming', label: 'Start Streaming', icon: '🔴' },
    { value: 'stop_streaming', label: 'Stop Streaming', icon: '⏹️' },
    { value: 'start_recording', label: 'Start Recording', icon: '⏺️' },
    { value: 'stop_recording', label: 'Stop Recording', icon: '⏸️' },
    { value: 'pause_recording', label: 'Pause Recording', icon: '⏸️' },
    { value: 'resume_recording', label: 'Resume Recording', icon: '▶️' },
    { value: 'start_replay_buffer', label: 'Start Replay Buffer', icon: '🎞️' },
    { value: 'stop_replay_buffer', label: 'Stop Replay Buffer', icon: '⏹️' },
    { value: 'save_replay_buffer', label: 'Save Replay', icon: '💾' },
    { value: 'screenshot', label: 'Take Screenshot', icon: '📸' },
    { value: 'studio_mode', label: 'Toggle Studio Mode', icon: '🎛️' },
    { value: 'virtual_cam', label: 'Toggle Virtual Camera', icon: '📹' },
    { value: 'source_transform', label: 'Transform Source', icon: '↔️' },
    { value: 'run_macro', label: 'Run Another Macro', icon: '🔄' }
  ];

  const conditionTypes: { value: MacroConditionType; label: string; icon: string }[] = [
    { value: 'manual', label: 'Manual Trigger (Button)', icon: '👆' },
    { value: 'scene_active', label: 'Scene is Active', icon: '🎬' },
    { value: 'streaming', label: 'Streaming Status', icon: '🔴' },
    { value: 'recording', label: 'Recording Status', icon: '⏺️' },
    { value: 'replay_buffer', label: 'Replay Buffer Status', icon: '🎞️' },
    { value: 'media_ended', label: 'Media Playback Ended', icon: '📹' },
    { value: 'time', label: 'Time of Day', icon: '🕐' },
    { value: 'date', label: 'Specific Date', icon: '📅' }
  ];

  const handleAddAction = () => {
    setActions([...actions, { type: 'wait', duration: 1 }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleUpdateAction = (index: number, updates: Partial<MacroAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newActions = [...actions];
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
      setActions(newActions);
    } else if (direction === 'down' && index < actions.length - 1) {
      const newActions = [...actions];
      [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
      setActions(newActions);
    }
  };

  // Else Actions handlers
  const handleAddElseAction = () => {
    setElseActions([...elseActions, { type: 'wait', duration: 1 }]);
  };

  const handleRemoveElseAction = (index: number) => {
    setElseActions(elseActions.filter((_, i) => i !== index));
  };

  const handleUpdateElseAction = (index: number, updates: Partial<MacroAction>) => {
    const newActions = [...elseActions];
    newActions[index] = { ...newActions[index], ...updates };
    setElseActions(newActions);
  };

  const handleMoveElseAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newActions = [...elseActions];
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
      setElseActions(newActions);
    } else if (direction === 'down' && index < elseActions.length - 1) {
      const newActions = [...elseActions];
      [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
      setElseActions(newActions);
    }
  };

  // Condition handlers
  const handleAddCondition = () => {
    setConditions([...conditions, { type: 'manual' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleUpdateCondition = (index: number, updates: Partial<MacroCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a macro name');
      return;
    }

    if (actions.length === 0 && elseActions.length === 0) {
      alert('Please add at least one action (either IF or ELSE)');
      return;
    }

    const newMacro: Macro = {
      id: macro?.id || `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      enabled,
      runOnce,
      parallel,
      conditionLogic,
      conditions,
      actions,
      elseActions: showElseActions ? elseActions : undefined
    };

    onSave(newMacro);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '20px' }}>
          <i className="fas fa-magic"></i> {macro ? 'Edit Macro' : 'Create New Macro'}
        </h3>

        {/* Basic Settings */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
            Macro Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Custom Replay Sequence"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this macro does..."
            style={{ width: '100%', padding: '8px', minHeight: '60px', resize: 'vertical' }}
          />
        </div>

        {/* Macro Settings */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          background: '#0f172a', 
          borderRadius: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enabled</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={runOnce}
              onChange={(e) => setRunOnce(e.target.checked)}
            />
            <span>Run Once</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={parallel}
              onChange={(e) => setParallel(e.target.checked)}
            />
            <span>Allow Parallel</span>
          </label>
        </div>

        {/* Conditions Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>
              <i className="fas fa-question-circle"></i> IF Conditions ({conditions.length})
            </h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {conditions.length > 1 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Logic:</span>
                  <select
                    value={conditionLogic}
                    onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR')}
                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  >
                    <option value="AND">AND (all must match)</option>
                    <option value="OR">OR (any can match)</option>
                  </select>
                </div>
              )}
              <button className="btn-primary" onClick={handleAddCondition} style={{ fontSize: '0.85rem' }}>
                <i className="fas fa-plus"></i> Add Condition
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {conditions.map((condition, index) => (
              <div
                key={index}
                style={{
                  padding: '16px',
                  background: '#1e3a8a',
                  borderRadius: '8px',
                  border: '2px solid #3b82f6'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: '#3b82f6',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      IF {index + 1}
                    </span>
                    <select
                      value={condition.type}
                      onChange={(e) => handleUpdateCondition(index, { type: e.target.value as MacroConditionType })}
                      style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                    >
                      {conditionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => handleRemoveCondition(index)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    disabled={conditions.length === 1}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>

                {/* Condition-specific inputs */}
                <div style={{ paddingLeft: '40px' }}>
                  {condition.type === 'scene_active' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                        Scene Name
                      </label>
                      <select
                        value={condition.sceneName || ''}
                        onChange={(e) => handleUpdateCondition(index, { sceneName: e.target.value })}
                        style={{ width: '100%', maxWidth: '300px', padding: '6px' }}
                      >
                        {availableScenes.map((scene) => (
                          <option key={scene} value={scene}>{scene}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {condition.type === 'media_ended' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                        Media Input Name (Source)
                      </label>
                      <select
                        value={condition.mediaInputName || ''}
                        onChange={(e) => handleUpdateCondition(index, { mediaInputName: e.target.value })}
                        style={{ width: '100%', maxWidth: '300px', padding: '6px' }}
                      >
                        <option value="">-- Any Media Source --</option>
                        
                        {groupedSources.scenes.length > 0 && (
                          <optgroup label="📁 Scenes (Groups)">
                            {groupedSources.scenes.map((scene) => (
                              <option key={`scene-${scene}`} value={scene}>{scene}</option>
                            ))}
                          </optgroup>
                        )}
                        
                        {groupedSources.inputs.length > 0 && (
                          <optgroup label="📹 Sources (Inputs)">
                            {groupedSources.inputs.map((source) => (
                              <option key={`input-${source}`} value={source}>{source}</option>
                            ))}
                          </optgroup>
                        )}
                        
                        {/* Fallback if no grouped data */}
                        {groupedSources.scenes.length === 0 && groupedSources.inputs.length === 0 && availableSources.map((source) => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#1e40af', 
                        borderRadius: '6px',
                        color: '#bfdbfe',
                        fontSize: '0.75rem'
                      }}>
                        <i className="fas fa-info-circle"></i> เลือก Media Source ที่ต้องการติดตาม (-- Any Media Source -- = ทุก source)
                      </div>
                    </div>
                  )}

                  {condition.type === 'streaming' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                        Streaming State
                      </label>
                      <select
                        value={condition.streamingState || 'active'}
                        onChange={(e) => handleUpdateCondition(index, { streamingState: e.target.value as 'active' | 'inactive' })}
                        style={{ width: '200px', padding: '6px' }}
                      >
                        <option value="active">Active (Streaming)</option>
                        <option value="inactive">Inactive (Not Streaming)</option>
                      </select>
                    </div>
                  )}

                  {condition.type === 'recording' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                        Recording State
                      </label>
                      <select
                        value={condition.recordingState || 'active'}
                        onChange={(e) => handleUpdateCondition(index, { recordingState: e.target.value as any })}
                        style={{ width: '200px', padding: '6px' }}
                      >
                        <option value="active">Active (Recording)</option>
                        <option value="inactive">Inactive (Not Recording)</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  )}

                  {condition.type === 'replay_buffer' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                        Replay Buffer State
                      </label>
                      <select
                        value={condition.replayBufferState || 'active'}
                        onChange={(e) => handleUpdateCondition(index, { replayBufferState: e.target.value as any })}
                        style={{ width: '250px', padding: '6px' }}
                      >
                        <option value="active">Active (Buffer Running)</option>
                        <option value="inactive">Inactive (Buffer Stopped)</option>
                        <option value="saved">Saved (Just Saved)</option>
                      </select>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-bolt"></i> Auto-trigger: This macro will run automatically when replay buffer {condition.replayBufferState === 'saved' ? 'is saved' : condition.replayBufferState === 'active' ? 'starts' : 'stops'}
                      </div>
                    </div>
                  )}

                  {condition.type === 'streaming' && (
                    <div>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-bolt"></i> Auto-trigger: This macro will run automatically when streaming {condition.streamingState === 'active' ? 'starts' : 'stops'}
                      </div>
                    </div>
                  )}

                  {condition.type === 'recording' && (
                    <div>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-bolt"></i> Auto-trigger: This macro will run automatically when recording state changes
                      </div>
                    </div>
                  )}

                  {condition.type === 'scene_active' && (
                    <div>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-bolt"></i> Auto-trigger: This macro will run automatically when scene "{condition.sceneName}" becomes active
                      </div>
                    </div>
                  )}

                  {condition.type === 'media_ended' && (
                    <div>
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-bolt"></i> Auto-trigger: This macro will run automatically when media "{condition.mediaInputName || 'any'}" finishes playing
                      </div>
                    </div>
                  )}

                  {condition.type === 'time' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                          Hour (0-23)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={condition.timeHour || 0}
                          onChange={(e) => handleUpdateCondition(index, { timeHour: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#dbeafe' }}>
                          Minute (0-59)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={condition.timeMinute || 0}
                          onChange={(e) => handleUpdateCondition(index, { timeMinute: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '6px' }}
                        />
                      </div>
                    </div>
                  )}

                  {condition.type === 'manual' && (
                    <div style={{ 
                      padding: '8px 12px', 
                      background: '#064e3b', 
                      borderRadius: '6px',
                      color: '#6ee7b7',
                      fontSize: '0.8rem'
                    }}>
                      <i className="fas fa-info-circle"></i> This macro will be triggered manually by clicking "Run" button
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>
              <i className="fas fa-list-ol"></i> Actions ({actions.length})
            </h4>
            <button className="btn-primary" onClick={handleAddAction} style={{ fontSize: '0.85rem' }}>
              <i className="fas fa-plus"></i> Add Action
            </button>
          </div>

          {actions.length === 0 ? (
            <div style={{
              padding: '32px',
              background: '#0f172a',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '8px' }}></i>
              <p>No actions yet. Click "Add Action" to start building your macro.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {actions.map((action, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    background: '#1e293b',
                    borderRadius: '8px',
                    border: '2px solid #334155'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: '#3b82f6',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {index + 1}
                      </span>
                      <select
                        value={action.type}
                        onChange={(e) => {
                          const newType = e.target.value as MacroActionType;
                          const baseAction: any = { type: newType };
                          
                          // Set defaults based on type
                          if (newType === 'wait') baseAction.duration = 1;
                          else if (newType === 'scene_switch') baseAction.sceneName = availableScenes[0];
                          else if (newType === 'source_show' || newType === 'source_hide') {
                            baseAction.sceneName = availableScenes[0];
                            baseAction.sourceName = availableSources[0];
                          }
                          
                          handleUpdateAction(index, baseAction);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                      >
                        {actionTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleMoveAction(index, 'up')}
                        disabled={index === 0}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px',
                          opacity: index === 0 ? 0.3 : 1
                        }}
                      >
                        <i className="fas fa-arrow-up"></i>
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => handleMoveAction(index, 'down')}
                        disabled={index === actions.length - 1}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px',
                          opacity: index === actions.length - 1 ? 0.3 : 1
                        }}
                      >
                        <i className="fas fa-arrow-down"></i>
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleRemoveAction(index)}
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Action-specific inputs */}
                  <div style={{ paddingLeft: '40px' }}>
                    {action.type === 'wait' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.5"
                          value={action.duration || 1}
                          onChange={(e) => handleUpdateAction(index, { duration: parseFloat(e.target.value) || 0 })}
                          style={{ width: '150px', padding: '6px' }}
                        />
                      </div>
                    )}

                    {action.type === 'scene_switch' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          Scene Name
                        </label>
                        <select
                          value={action.sceneName || ''}
                          onChange={(e) => handleUpdateAction(index, { sceneName: e.target.value })}
                          style={{ width: '100%', maxWidth: '300px', padding: '6px' }}
                        >
                          {availableScenes.map((scene) => (
                            <option key={scene} value={scene}>{scene}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(action.type === 'source_show' || action.type === 'source_hide') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          {action.type === 'source_show' ? 'Show Source in Scene' : 'Hide Source in Scene'}
                        </label>
                        <select
                          value={action.sceneName && action.sourceName ? `${action.sceneName}|${action.sourceName}` : ''}
                          onChange={(e) => {
                            const [sceneName, sourceName] = e.target.value.split('|');
                            // Find sceneItemId from scene items
                            const item = sceneItems.find(
                              (it) => it.sceneName === sceneName && it.sourceName === sourceName && it.visible === (action.type === 'source_show')
                            );
                            handleUpdateAction(index, { 
                              sceneName, 
                              sourceName,
                              sceneItemId: item?.sceneItemId 
                            });
                          }}
                          style={{ width: '100%', padding: '6px', maxHeight: '200px' }}
                        >
                          <option value="">-- Select Source --</option>
                          {sceneItems
                            .filter((item) => item.visible === (action.type === 'source_show'))
                            .map((item, idx) => (
                              <option key={idx} value={`${item.sceneName}|${item.sourceName}`}>
                                {item.label}
                              </option>
                            ))}
                        </select>
                        
                        {/* Show selected info */}
                        {action.sceneName && action.sourceName && (
                          <div style={{ 
                            marginTop: '8px',
                            padding: '6px 10px',
                            background: '#1e40af',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#bfdbfe'
                          }}>
                            <i className="fas fa-info-circle"></i> Scene: <strong>{action.sceneName}</strong> | Source: <strong>{action.sourceName}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {(action.type === 'source_mute' || action.type === 'source_unmute') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          Audio Source Name
                        </label>
                        <input
                          type="text"
                          value={action.sourceName || ''}
                          onChange={(e) => handleUpdateAction(index, { sourceName: e.target.value })}
                          placeholder="e.g., Mic/Aux, Desktop Audio"
                          style={{ width: '100%', maxWidth: '300px', padding: '6px' }}
                        />
                      </div>
                    )}

                    {action.type === 'source_volume' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Audio Source Name
                          </label>
                          <input
                            type="text"
                            value={action.sourceName || ''}
                            onChange={(e) => handleUpdateAction(index, { sourceName: e.target.value })}
                            placeholder="e.g., Mic/Aux"
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Volume (0-100)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={action.volume || 100}
                            onChange={(e) => handleUpdateAction(index, { volume: parseInt(e.target.value) || 100 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                      </div>
                    )}

                    {(action.type === 'filter_enable' || action.type === 'filter_disable') && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Source Name
                          </label>
                          <select
                            value={action.sourceName || ''}
                            onChange={(e) => handleUpdateAction(index, { sourceName: e.target.value })}
                            style={{ width: '100%', padding: '6px' }}
                          >
                            {groupedSources.scenes.length > 0 && (
                              <optgroup label="📁 Scenes">
                                {groupedSources.scenes.map((scene) => (
                                  <option key={`scene-${scene}`} value={scene}>{scene}</option>
                                ))}
                              </optgroup>
                            )}
                            
                            {groupedSources.inputs.length > 0 && (
                              <optgroup label="📹 Sources">
                                {groupedSources.inputs.map((source) => (
                                  <option key={`input-${source}`} value={source}>{source}</option>
                                ))}
                              </optgroup>
                            )}
                            
                            {groupedSources.scenes.length === 0 && groupedSources.inputs.length === 0 && availableSources.map((source) => (
                              <option key={source} value={source}>{source}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Filter Name
                          </label>
                          <input
                            type="text"
                            value={action.filterName || ''}
                            onChange={(e) => handleUpdateAction(index, { filterName: e.target.value })}
                            placeholder="Filter name"
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'screenshot' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          Screenshot Path (optional)
                        </label>
                        <input
                          type="text"
                          value={action.screenshotPath || ''}
                          onChange={(e) => handleUpdateAction(index, { screenshotPath: e.target.value })}
                          placeholder="Leave empty for auto-generated name"
                          style={{ width: '100%', maxWidth: '400px', padding: '6px' }}
                        />
                      </div>
                    )}

                    {action.type === 'source_transform' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Scene Name
                          </label>
                          <select
                            value={action.sceneName || ''}
                            onChange={(e) => handleUpdateAction(index, { sceneName: e.target.value })}
                            style={{ width: '100%', padding: '6px' }}
                          >
                            {availableScenes.map((scene) => (
                              <option key={scene} value={scene}>{scene}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Source Name
                          </label>
                          <select
                            value={action.sourceName || ''}
                            onChange={(e) => handleUpdateAction(index, { sourceName: e.target.value })}
                            style={{ width: '100%', padding: '6px' }}
                          >
                            {groupedSources.scenes.length > 0 && (
                              <optgroup label="📁 Scenes">
                                {groupedSources.scenes.map((scene) => (
                                  <option key={`scene-${scene}`} value={scene}>{scene}</option>
                                ))}
                              </optgroup>
                            )}
                            
                            {groupedSources.inputs.length > 0 && (
                              <optgroup label="📹 Sources">
                                {groupedSources.inputs.map((source) => (
                                  <option key={`input-${source}`} value={source}>{source}</option>
                                ))}
                              </optgroup>
                            )}
                            
                            {groupedSources.scenes.length === 0 && groupedSources.inputs.length === 0 && availableSources.map((source) => (
                              <option key={source} value={source}>{source}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            X Position
                          </label>
                          <input
                            type="number"
                            value={action.transformX || 0}
                            onChange={(e) => handleUpdateAction(index, { transformX: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Y Position
                          </label>
                          <input
                            type="number"
                            value={action.transformY || 0}
                            onChange={(e) => handleUpdateAction(index, { transformY: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Scale X (1.0 = 100%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={action.transformScaleX || 1}
                            onChange={(e) => handleUpdateAction(index, { transformScaleX: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Scale Y (1.0 = 100%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={action.transformScaleY || 1}
                            onChange={(e) => handleUpdateAction(index, { transformScaleY: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                            Rotation (degrees)
                          </label>
                          <input
                            type="number"
                            value={action.transformRotation || 0}
                            onChange={(e) => handleUpdateAction(index, { transformRotation: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'hotkey' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                          Hotkey Name
                        </label>
                        <input
                          type="text"
                          value={action.hotkeyName || ''}
                          onChange={(e) => handleUpdateAction(index, { hotkeyName: e.target.value })}
                          placeholder="e.g., libobs.show_scene_item.123"
                          style={{ width: '100%', maxWidth: '400px', padding: '6px' }}
                        />
                      </div>
                    )}

                    {(action.type === 'start_streaming' || 
                      action.type === 'stop_streaming' ||
                      action.type === 'start_recording' ||
                      action.type === 'stop_recording' ||
                      action.type === 'pause_recording' ||
                      action.type === 'resume_recording' ||
                      action.type === 'start_replay_buffer' ||
                      action.type === 'stop_replay_buffer' ||
                      action.type === 'save_replay_buffer' ||
                      action.type === 'studio_mode' ||
                      action.type === 'virtual_cam') && (
                      <div style={{ 
                        padding: '8px 12px', 
                        background: '#064e3b', 
                        borderRadius: '6px',
                        color: '#6ee7b7',
                        fontSize: '0.8rem'
                      }}>
                        <i className="fas fa-info-circle"></i> This action requires no additional parameters
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ELSE Actions Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0 }}>
              <i className="fas fa-code-branch"></i> ELSE Actions ({elseActions.length})
            </h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showElseActions}
                  onChange={(e) => setShowElseActions(e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem' }}>Enable ELSE Actions</span>
              </label>
              {showElseActions && (
                <button className="btn-primary" onClick={handleAddElseAction} style={{ fontSize: '0.85rem' }}>
                  <i className="fas fa-plus"></i> Add ELSE Action
                </button>
              )}
            </div>
          </div>

          {showElseActions && (
            <>
              {elseActions.length === 0 ? (
                <div style={{
                  padding: '32px',
                  background: '#7c2d12',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#fbbf24',
                  border: '2px dashed #f97316'
                }}>
                  <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '8px' }}></i>
                  <p>No ELSE actions yet. These will run if conditions are NOT met.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {elseActions.map((action, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '16px',
                        background: '#7c2d12',
                        borderRadius: '8px',
                        border: '2px solid #f97316'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: '#f97316',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            ELSE #{index + 1}
                          </span>
                          <select
                            value={action.type}
                            onChange={(e) => {
                              const newType = e.target.value as MacroActionType;
                              const baseAction: any = { type: newType };
                              
                              if (newType === 'wait') baseAction.duration = 1;
                              else if (newType === 'scene_switch') baseAction.sceneName = availableScenes[0];
                              else if (newType === 'source_show' || newType === 'source_hide') {
                                baseAction.sceneName = availableScenes[0];
                                baseAction.sourceName = availableSources[0];
                              }
                              
                              handleUpdateElseAction(index, baseAction);
                            }}
                            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                          >
                            {actionTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.icon} {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => handleMoveElseAction(index, 'up')}
                            disabled={index === 0}
                            style={{ 
                              fontSize: '0.75rem', 
                              padding: '4px 8px',
                              opacity: index === 0 ? 0.3 : 1
                            }}
                          >
                            <i className="fas fa-arrow-up"></i>
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleMoveElseAction(index, 'down')}
                            disabled={index === elseActions.length - 1}
                            style={{ 
                              fontSize: '0.75rem', 
                              padding: '4px 8px',
                              opacity: index === elseActions.length - 1 ? 0.3 : 1
                            }}
                          >
                            <i className="fas fa-arrow-down"></i>
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleRemoveElseAction(index)}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      {/* Same action inputs as IF actions, just use handleUpdateElseAction */}
                      <div style={{ paddingLeft: '40px', opacity: 0.9 }}>
                        {/* Copy the same action input logic but call handleUpdateElseAction instead */}
                        {action.type === 'wait' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                              Duration (seconds)
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.5"
                              value={action.duration || 1}
                              onChange={(e) => handleUpdateElseAction(index, { duration: parseFloat(e.target.value) || 0 })}
                              style={{ width: '150px', padding: '6px' }}
                            />
                          </div>
                        )}

                        {action.type === 'scene_switch' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                              Scene Name
                            </label>
                            <select
                              value={action.sceneName || ''}
                              onChange={(e) => handleUpdateElseAction(index, { sceneName: e.target.value })}
                              style={{ width: '100%', maxWidth: '300px', padding: '6px' }}
                            >
                              {availableScenes.map((scene) => (
                                <option key={scene} value={scene}>{scene}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Add more action types as needed - simplified for now */}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Box */}
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          background: '#064e3b',
          borderRadius: '6px',
          borderLeft: '4px solid #10b981',
          fontSize: '0.85rem',
          color: '#a7f3d0'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <i className="fas fa-lightbulb" style={{ marginTop: '2px', color: '#fbbf24' }}></i>
            <div>
              <strong style={{ color: '#6ee7b7' }}>💡 Tips:</strong><br />
              • Actions run in order from top to bottom<br />
              • Use "Wait" to add delays between actions<br />
              • "Run Once" prevents macro from running multiple times<br />
              • "Allow Parallel" lets macro run alongside others
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn-secondary" onClick={onCancel}>
            <i className="fas fa-times"></i> Cancel
          </button>
          <button className="btn-success" onClick={handleSave}>
            <i className="fas fa-save"></i> {macro ? 'Update' : 'Create'} Macro
          </button>
        </div>
      </div>
    </div>
  );
}
