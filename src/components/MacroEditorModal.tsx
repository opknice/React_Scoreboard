import { useState, useEffect } from 'react';
import type { CustomMacro, ActionStep, ActionType } from '../types/macro';

interface MacroEditorModalProps {
  obs?: any;
  macro?: CustomMacro | null;
  onSave: (macroData: Partial<CustomMacro>) => void;
  onClose: () => void;
}

const COMMON_OBS_EVENTS = [
  { label: 'เมื่อกดบันทึก Replay Buffer (ReplayBufferSaved)', value: 'ReplayBufferSaved' },
  { label: 'เมื่อคลิปวิดีโอเล่นจบ (MediaInputPlaybackEnded)', value: 'MediaInputPlaybackEnded' },
  { label: 'เมื่อคลิปวิดีโอเริ่มเล่น (MediaInputPlaybackStarted)', value: 'MediaInputPlaybackStarted' },
  { label: 'เมื่อมีการเปลี่ยน Scene ใน OBS (CurrentProgramSceneChanged)', value: 'CurrentProgramSceneChanged' },
  { label: 'เมื่อเริ่ม/หยุด การถ่ายทอดสด (StreamStateChanged)', value: 'StreamStateChanged' },
  { label: 'เมื่อเริ่ม/หยุด การบันทึกวิดีโอ (RecordStateChanged)', value: 'RecordStateChanged' }
];

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

export default function MacroEditorModal({ obs, macro, onSave, onClose }: MacroEditorModalProps) {
  const [name, setName] = useState(macro?.name || 'Macro ใหม่ของฉัน');
  const [color, setColor] = useState(macro?.color || '#3b82f6');
  const [event, setEvent] = useState(macro?.trigger?.event || 'ReplayBufferSaved');
  const [filterKey, setFilterKey] = useState(macro?.trigger?.filterKey || '');
  const [filterValue, setFilterValue] = useState(macro?.trigger?.filterValue || '');
  const [actions, setActions] = useState<ActionStep[]>(
    macro?.actions || [
      { id: 'step_1', type: 'wait', delayMs: 1000 },
      { id: 'step_2', type: 'switchScene', sceneName: 'Main Stream' }
    ]
  );

  // Live OBS Data
  const [scenes, setScenes] = useState<string[]>([]);
  const [allInputs, setAllInputs] = useState<string[]>([]);
  const [sceneItemsMap, setSceneItemsMap] = useState<Record<string, string[]>>({});
  const [isLoadingObs, setIsLoadingObs] = useState<boolean>(false);

  // Custom text mode toggles (when custom entry is preferred over dropdown)
  const [customModeMap, setCustomModeMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!obs || !obs.isConnected) return;

    let isMounted = true;
    setIsLoadingObs(true);

    const fetchObsData = async () => {
      try {
        // 1. Fetch Scenes
        const sceneListRes = await obs.call('GetSceneList');
        const fetchedScenes: string[] = (sceneListRes?.scenes || []).map((s: any) => s.sceneName).reverse();

        // 2. Fetch Inputs (All Sources)
        const inputListRes = await obs.call('GetInputList');
        const fetchedInputs: string[] = (inputListRes?.inputs || []).map((i: any) => i.inputName);

        // 3. Fetch Scene Items for each Scene
        const itemsMap: Record<string, string[]> = {};
        for (const sceneName of fetchedScenes) {
          try {
            const itemsRes = await obs.call('GetSceneItemList', { sceneName });
            itemsMap[sceneName] = (itemsRes?.sceneItems || []).map((item: any) => item.sourceName);
          } catch (e) {
            console.warn(`Failed to fetch scene items for ${sceneName}`, e);
          }
        }

        if (isMounted) {
          setScenes(fetchedScenes);
          setAllInputs(fetchedInputs);
          setSceneItemsMap(itemsMap);
        }
      } catch (err) {
        console.error('Failed to fetch OBS data for dropdowns', err);
      } finally {
        if (isMounted) setIsLoadingObs(false);
      }
    };

    fetchObsData();

    return () => {
      isMounted = false;
    };
  }, [obs?.isConnected]);

  const toggleCustomMode = (key: string) => {
    setCustomModeMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addStep = (type: ActionType) => {
    const defaultScene = scenes[0] || 'Main Stream';
    const defaultSource = (sceneItemsMap[defaultScene] && sceneItemsMap[defaultScene][0]) || allInputs[0] || '';

    const newStep: ActionStep = {
      id: 'step_' + Date.now(),
      type,
      ...(type === 'wait' ? { delayMs: 1000 } : {}),
      ...(type === 'switchScene' ? { sceneName: defaultScene } : {}),
      ...(type === 'showSource' || type === 'hideSource' ? { sourceScene: defaultScene, sourceName: defaultSource } : {})
    };
    setActions([...actions, newStep]);
  };

  const removeStep = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === actions.length - 1)) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...actions];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setActions(copy);
  };

  const updateStep = (index: number, patch: Partial<ActionStep>) => {
    setActions(actions.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('กรุณากรอกชื่อ Macro');
      return;
    }
    onSave({
      name,
      color,
      trigger: {
        event,
        filterKey,
        filterValue
      },
      actions
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1100 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '0' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#1e293b',
            borderBottom: '2px solid #334155',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <i className="fas fa-cog" style={{ color }}></i>
            {macro ? 'แก้ไข Macro อัตโนมัติ' : 'สร้าง Macro อัตโนมัติใหม่'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* OBS Live Status Indicator */}
          {obs?.isConnected ? (
            <div
              style={{
                padding: '8px 12px',
                background: '#064e3b',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#6ee7b7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>
                <i className="fas fa-plug"></i> เชื่อมต่อ OBS Live WebSocket แล้ว (พบ {scenes.length} Scenes, {allInputs.length} Sources)
              </span>
              {isLoadingObs && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>กำลังซิงค์...</span>}
            </div>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                background: '#7c2d12',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#fca5a5'
              }}
            >
              <i className="fas fa-exclamation-triangle"></i> ไม่ได้เชื่อมต่อ OBS — ใช้งานโหมดพิมพ์ข้อความเอง (Fallback Text Mode)
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#38bdf8', fontSize: '0.95rem' }}>1. ตั้งชื่อและธีมสี (Basic Settings)</h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>
                ชื่อ Macro
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สลับไปหน้า Replay เมื่อเซฟไฮไลท์"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '6px' }}>
                ธีมสีสัญลักษณ์ (Theme Color)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '3px solid #fff' : 'none',
                      cursor: 'pointer',
                      boxShadow: color === c ? '0 0 8px ' + c : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: OBS Trigger */}
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#38bdf8', fontSize: '0.95rem' }}>2. เงื่อนไขการเริ่มทำงาน (OBS Trigger)</h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>
                เลือกเหตุการณ์ใน OBS ที่จุดชนวน (OBS Event Type)
              </label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                {COMMON_OBS_EVENTS.map((evt) => (
                  <option key={evt.value} value={evt.value}>
                    {evt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>
                  หัวข้อตัวกรองข้อมูล (Optional Filter Key)
                </label>
                <select
                  value={filterKey}
                  onChange={(e) => setFilterKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">ไม่กรองข้อมูล (ทำงานทุกกรณี)</option>
                  <option value="inputName">inputName (ชื่อ Source วิดีโอ/มีเดีย)</option>
                  <option value="sceneName">sceneName (ชื่อ Scene)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>
                  ค่าที่ต้องการกรอง (Optional Filter Value)
                </label>
                {allInputs.length > 0 && filterKey === 'inputName' ? (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="">เลือก Source ใน OBS...</option>
                    {allInputs.map((input) => (
                      <option key={input} value={input}>
                        {input}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="เช่น Source Replay"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Action Sequence */}
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.95rem' }}>3. ขั้นตอนการทำงานตามลำดับ (Action Sequence)</h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => addStep('wait')}
                  style={{
                    padding: '4px 8px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  + หน่วงเวลา (Wait)
                </button>
                <button
                  type="button"
                  onClick={() => addStep('switchScene')}
                  style={{
                    padding: '4px 8px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  + สลับ Scene
                </button>
                <button
                  type="button"
                  onClick={() => addStep('showSource')}
                  style={{
                    padding: '4px 8px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  + แสดง Source
                </button>
                <button
                  type="button"
                  onClick={() => addStep('hideSource')}
                  style={{
                    padding: '4px 8px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  + ซ่อน Source
                </button>
              </div>
            </div>

            {actions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.85rem' }}>
                ยังไม่มีขั้นตอนการทำงาน คลิกปุ่มด้านบนเพื่อเพิ่มขั้นตอนตามลำดับ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actions.map((step, idx) => {
                  const sceneCustomKey = `scene_${step.id}`;
                  const sourceCustomKey = `source_${step.id}`;
                  const isCustomScene = customModeMap[sceneCustomKey];
                  const isCustomSource = customModeMap[sourceCustomKey];

                  // Sources for selected scene or allInputs
                  const sceneSources = (step.sourceScene && sceneItemsMap[step.sourceScene]) || allInputs;

                  return (
                    <div
                      key={step.id}
                      style={{
                        background: '#1e293b',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${color}`
                      }}
                    >
                      {/* Row 1: Step number + Type selector + Move/Delete buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: step.type !== 'wait' || true ? '8px' : '0' }}>
                        <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', minWidth: '24px' }}>
                          #{idx + 1}
                        </span>

                        <select
                          value={step.type}
                          onChange={(e) => updateStep(idx, { type: e.target.value as ActionType })}
                          style={{
                            flex: 1,
                            padding: '5px 8px',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '4px',
                            color: '#38bdf8',
                            fontSize: '0.8rem'
                          }}
                        >
                          <option value="wait">⏳ หน่วงเวลา (Wait)</option>
                          <option value="switchScene">🔄 สลับ Scene</option>
                          <option value="showSource">👁️ แสดง/เปิด Source</option>
                          <option value="hideSource">🙈 ซ่อน/ปิด Source</option>
                        </select>

                        {/* Reorder / Delete */}
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => moveStep(idx, 'up')}
                            disabled={idx === 0}
                            title="เลื่อนขึ้น"
                            style={{
                              background: idx === 0 ? 'transparent' : '#334155',
                              border: 'none',
                              color: idx === 0 ? '#475569' : '#94a3b8',
                              cursor: idx === 0 ? 'default' : 'pointer',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem'
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(idx, 'down')}
                            disabled={idx === actions.length - 1}
                            title="เลื่อนลง"
                            style={{
                              background: idx === actions.length - 1 ? 'transparent' : '#334155',
                              border: 'none',
                              color: idx === actions.length - 1 ? '#475569' : '#94a3b8',
                              cursor: idx === actions.length - 1 ? 'default' : 'pointer',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem'
                            }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            title="ลบขั้นตอนนี้"
                            style={{
                              background: '#7f1d1d',
                              border: 'none',
                              color: '#fca5a5',
                              cursor: 'pointer',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Step-specific inputs */}
                      {step.type === 'wait' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '32px' }}>
                          <label style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>ระยะเวลา:</label>
                          <input
                            type="number"
                            value={step.delayMs || 1000}
                            onChange={(e) => updateStep(idx, { delayMs: Number(e.target.value) })}
                            style={{
                              width: '90px',
                              padding: '4px 8px',
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.85rem'
                            }}
                            step="500"
                            min="100"
                          />
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>ms</span>
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            ({((step.delayMs || 1000) / 1000).toFixed(1)} วินาที)
                          </span>
                        </div>
                      )}

                      {step.type === 'switchScene' && (
                        <div style={{ paddingLeft: '32px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <label style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Scene:</label>
                          {scenes.length > 0 && !isCustomScene ? (
                            <select
                              value={step.sceneName || ''}
                              onChange={(e) => updateStep(idx, { sceneName: e.target.value })}
                              style={{
                                flex: 1,
                                padding: '5px 8px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.85rem'
                              }}
                            >
                              {scenes.map((sc) => (
                                <option key={sc} value={sc}>🎬 {sc}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={step.sceneName || ''}
                              onChange={(e) => updateStep(idx, { sceneName: e.target.value })}
                              placeholder="ชื่อ Scene เช่น Replay"
                              style={{
                                flex: 1,
                                padding: '5px 8px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.85rem'
                              }}
                            />
                          )}
                          {scenes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleCustomMode(sceneCustomKey)}
                              title={isCustomScene ? 'ใช้ตัวเลือกจาก OBS' : 'พิมพ์ข้อความเอง'}
                              style={{
                                background: '#334155',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isCustomScene ? '📋' : '✏️'}
                            </button>
                          )}
                        </div>
                      )}

                      {(step.type === 'showSource' || step.type === 'hideSource') && (
                        <div style={{ paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Scene row */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <label style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap', width: '50px' }}>Scene:</label>
                            {scenes.length > 0 && !isCustomScene ? (
                              <select
                                value={step.sourceScene || ''}
                                onChange={(e) => updateStep(idx, { sourceScene: e.target.value })}
                                style={{
                                  flex: 1,
                                  padding: '5px 8px',
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {scenes.map((sc) => (
                                  <option key={sc} value={sc}>🎬 {sc}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={step.sourceScene || ''}
                                onChange={(e) => updateStep(idx, { sourceScene: e.target.value })}
                                placeholder="ชื่อ Scene เช่น Main Stream"
                                style={{
                                  flex: 1,
                                  padding: '5px 8px',
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '0.85rem'
                                }}
                              />
                            )}
                            {scenes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleCustomMode(sceneCustomKey)}
                                title={isCustomScene ? 'ใช้ตัวเลือกจาก OBS' : 'พิมพ์ข้อความเอง'}
                                style={{
                                  background: '#334155',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  padding: '3px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                {isCustomScene ? '📋' : '✏️'}
                              </button>
                            )}
                          </div>
                          {/* Source row */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <label style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap', width: '50px' }}>Source:</label>
                            {sceneSources.length > 0 && !isCustomSource ? (
                              <select
                                value={step.sourceName || ''}
                                onChange={(e) => updateStep(idx, { sourceName: e.target.value })}
                                style={{
                                  flex: 1,
                                  padding: '5px 8px',
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {sceneSources.map((srcName) => (
                                  <option key={srcName} value={srcName}>👁️ {srcName}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={step.sourceName || ''}
                                onChange={(e) => updateStep(idx, { sourceName: e.target.value })}
                                placeholder="ชื่อ Source เช่น Goal_Alert"
                                style={{
                                  flex: 1,
                                  padding: '5px 8px',
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '0.85rem'
                                }}
                              />
                            )}
                            {scenes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleCustomMode(sourceCustomKey)}
                                title={isCustomSource ? 'ใช้ตัวเลือกจาก OBS' : 'พิมพ์ข้อความเอง'}
                                style={{
                                  background: '#334155',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  padding: '3px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                {isCustomSource ? '📋' : '✏️'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            background: '#1e293b',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#334155',
              border: 'none',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              background: color || '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            💾 บันทึก Macro
          </button>
        </div>
      </div>
    </div>
  );
}
