import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { ActionStep, ActionType, CustomMacro, MacroEvent, MacroFilter } from '../types/macro';
import {
  MACRO_EVENT_OPTIONS,
  OBS_HOTKEY_OPTIONS,
  SCOREBOARD_BUTTON_OPTIONS,
  getMacroEventOption,
} from '../macros/macroEventCatalog';
import { normalizeMacroFilter } from '../macros/macroTrigger';
import { describeAction } from '../macros/macroSummary';

interface MacroEditorModalProps {
  obs?: any;
  macro?: CustomMacro | null;
  onSave: (macroData: Partial<CustomMacro>) => void;
  onClose: () => void;
}

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

const ACTION_OPTIONS: Array<{ value: ActionType; label: string }> = [
  { value: 'switchScene', label: 'สลับ Scene' },
  { value: 'showSource', label: 'แสดง Source' },
  { value: 'hideSource', label: 'ซ่อน Source' },
  { value: 'wait', label: 'รอเวลา' },
  { value: 'openVarReplay', label: 'เปิด VAR Replay' },
  { value: 'closeVarReplay', label: 'ปิด VAR Replay' },
  { value: 'openReplayControl', label: 'เปิด Replay Control' },
  { value: 'closeReplayControl', label: 'ปิด Replay Control' },
  { value: 'saveReplayBuffer', label: 'บันทึก Replay Buffer' },
  { value: 'loadLatestReplay', label: 'โหลด Replay ล่าสุด' },
];

const CATEGORY_LABELS = {
  scoreboard: 'Scoreboard',
  obs: 'OBS',
  keyboard: 'คีย์บอร์ด',
};

function makeStep(type: ActionType): ActionStep {
  const id = `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'wait') return { id, type, delayMs: 1000 };
  if (type === 'switchScene') return { id, type, sceneName: '' };
  if (type === 'showSource' || type === 'hideSource') return { id, type, sourceScene: '', sourceName: '' };
  return { id, type };
}

function fieldStyle(): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '7px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '0.9rem',
  };
}

function buttonStyle(primary = false): CSSProperties {
  return {
    border: 'none',
    borderRadius: '7px',
    padding: '9px 14px',
    color: primary ? '#fff' : '#cbd5e1',
    background: primary ? '#0284c7' : '#334155',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: primary ? 600 : 400,
  };
}

export default function MacroEditorModal({ obs, macro, onSave, onClose }: MacroEditorModalProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(macro?.name || 'Automation ใหม่');
  const [color, setColor] = useState(macro?.color || '#3b82f6');
  const [event, setEvent] = useState<MacroEvent>(macro?.trigger?.event || 'ReplayBufferSaved');
  const existingFilter = normalizeMacroFilter(macro?.trigger || { event: 'ReplayBufferSaved' });
  const [filter, setFilter] = useState<MacroFilter>(existingFilter);
  const [actions, setActions] = useState<ActionStep[]>(macro?.actions || [makeStep('wait')]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [allInputs, setAllInputs] = useState<string[]>([]);
  const [mediaInputs, setMediaInputs] = useState<string[]>([]);
  const [sceneItemsMap, setSceneItemsMap] = useState<Record<string, string[]>>({});
  const [isLoadingObs, setIsLoadingObs] = useState(false);
  const [error, setError] = useState('');
  const obsRef = useRef(obs);
  obsRef.current = obs;

  const eventOption = getMacroEventOption(event);

  useEffect(() => {
    if (!obs?.isConnected) return undefined;
    const currentObs = obsRef.current;
    let mounted = true;
    setIsLoadingObs(true);
    void (async () => {
      try {
        const sceneResult = await currentObs.call('GetSceneList');
        const fetchedScenes = (sceneResult?.scenes || []).map((item: any) => item.sceneName).reverse();
        const inputResult = await currentObs.call('GetInputList');
        const inputItems = inputResult?.inputs || [];
        const fetchedInputs = inputItems.map((item: any) => item.inputName);
        const fetchedMediaInputs = inputItems
          .filter((item: any) => {
            const inputKind = String(item?.inputKind || '').toLowerCase();
            return inputKind.includes('media')
              || ['ffmpeg_source', 'vlc_source', 'mpv_source'].includes(inputKind);
          })
          .map((item: any) => item.inputName);
        const itemMap: Record<string, string[]> = {};
        for (const sceneName of fetchedScenes) {
          try {
            const result = await currentObs.call('GetSceneItemList', { sceneName });
            itemMap[sceneName] = (result?.sceneItems || []).map((item: any) => item.sourceName);
          } catch {
            itemMap[sceneName] = [];
          }
        }
        if (mounted) {
          setScenes(fetchedScenes);
          setAllInputs(fetchedInputs);
          setMediaInputs(fetchedMediaInputs);
          setSceneItemsMap(itemMap);
        }
      } catch {
        if (mounted) setError('ไม่สามารถโหลดรายการ Scene/Source จาก OBS ได้ คุณยังกรอกข้อมูลเองได้');
      } finally {
        if (mounted) setIsLoadingObs(false);
      }
    })();
    return () => { mounted = false; };
  }, [obs?.isConnected]);

  const sourceOptions = useMemo(() => {
    const values = Object.values(sceneItemsMap).flat();
    return Array.from(new Set([...allInputs, ...values]));
  }, [allInputs, sceneItemsMap]);

  const updateFilter = (updates: Partial<MacroFilter>) => {
    setError('');
    setFilter((previous) => ({ ...previous, ...updates }));
  };

  const selectEvent = (nextEvent: MacroEvent) => {
    const nextOption = getMacroEventOption(nextEvent);
    setError('');
    setEvent(nextEvent);
    setFilter({ kind: nextOption.filterKind, value: '', modifiers: [], keyField: 'code' });
  };

  const updateAction = (id: string, updates: Partial<ActionStep>) => {
    setActions((previous) => previous.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleActionTypeChange = (id: string, event: ChangeEvent<HTMLSelectElement>) => {
    const selectedType = event.currentTarget.value as ActionType;
    setActions((previous) => previous.map((item) => item.id === id ? makeStep(selectedType) : item));
  };

  const handleAddAction = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedType = event.currentTarget.value as ActionType;
    if (!selectedType) return;

    setActions((previous) => [...previous, makeStep(selectedType)]);
    event.currentTarget.value = '';
  };

  const removeAction = (id: string) => {
    setActions((previous) => previous.filter((item) => item.id !== id));
  };

  const moveAction = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    setActions((previous) => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const validateStep = (targetStep: number): string => {
    if (targetStep >= 1 && !name.trim()) return 'กรุณาตั้งชื่อ Automation';
    if (targetStep >= 2) {
      if (actions.length === 0) return 'กรุณาเพิ่มอย่างน้อย 1 ขั้นตอน';
      for (const action of actions) {
        if ((action.type === 'switchScene' && !action.sceneName)
          || ((action.type === 'showSource' || action.type === 'hideSource') && !action.sourceName)) {
          return 'กรุณาเลือกข้อมูลให้ครบในแต่ละขั้นตอน';
        }
        if (action.type === 'wait' && (action.delayMs === undefined || action.delayMs < 0)) {
          return 'เวลารอต้องเป็น 0 วินาทีขึ้นไป';
        }
      }
    }
    if (targetStep >= 1 && eventOption.filterKind !== 'any' && filter.kind !== 'any' && !filter.value) {
      return 'กรุณาเลือกเงื่อนไขของเหตุการณ์ หรือเลือก “ทุกครั้ง”';
    }
    return '';
  };

  const goTo = (targetStep: number) => {
    if (targetStep <= step) {
      setError('');
      setStep(targetStep);
      return;
    }

    const message = validateStep(targetStep);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep(targetStep);
  };

  const save = () => {
    const message = validateStep(2);
    if (message) {
      setError(message);
      return;
    }
    onSave({
      name: name.trim(),
      color,
      trigger: {
        event,
        filter: filter.kind === 'any' ? { kind: 'any' } : filter,
      },
      actions,
    });
    onClose();
  };

  const renderTriggerFilter = () => {
    if (eventOption.filterKind === 'any') {
      return <div style={{ color: '#6ee7b7', fontSize: '0.85rem' }}>ระบบจะทำงานทุกครั้งที่เกิดเหตุการณ์นี้</div>;
    }

    if (eventOption.filterKind === 'button') {
      return (
        <>
          <ToggleChoice label="ทุกปุ่ม" active={filter.kind === 'any'} onClick={() => updateFilter({ kind: 'any', value: '', modifiers: [] })} />
          <ToggleChoice label="ปุ่มที่เลือก" active={filter.kind === 'button'} onClick={() => updateFilter({ kind: 'button', value: filter.value || 'var_replay' })} />
          {filter.kind === 'button' && (
            <select style={fieldStyle()} value={filter.value || ''} onChange={(e) => updateFilter({ value: e.target.value })}>
              <option value="">เลือกปุ่ม...</option>
              {SCOREBOARD_BUTTON_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          )}
        </>
      );
    }

    if (eventOption.filterKind === 'key') {
      return (
        <>
          <ToggleChoice label="ทุกคีย์" active={filter.kind === 'any'} onClick={() => updateFilter({ kind: 'any', value: '', modifiers: [], keyField: 'code' })} />
          <ToggleChoice label="คีย์ที่เลือก" active={filter.kind === 'key'} onClick={() => updateFilter({ kind: 'key', value: filter.value || '', keyField: 'code' })} />
          {filter.kind !== 'key' ? null : (
            <>
          <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', marginBottom: 6 }}>คีย์ที่ต้องการ</label>
          <input
            style={fieldStyle()}
            value={filter.value || ''}
            placeholder="เช่น F5, KeyA, Space"
            onKeyDown={(e) => {
              if (['Tab'].includes(e.key)) return;
              e.preventDefault();
              if (['Backspace', 'Delete', 'Escape'].includes(e.key)) {
                updateFilter({ kind: 'key', value: '', keyField: 'code' });
                return;
              }
              if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
              updateFilter({ kind: 'key', value: e.code, keyField: 'code' });
            }}
            readOnly
          />
          <button type="button" style={{ ...buttonStyle(), marginTop: 8 }} onClick={() => updateFilter({ kind: 'key', value: '', keyField: 'code' })}>ล้างคีย์</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['ctrl', 'shift', 'alt', 'meta'].map((modifier) => {
              const active = (filter.modifiers || []).includes(modifier);
              return <button key={modifier} type="button" style={{ ...buttonStyle(active), background: active ? '#0284c7' : '#334155' }} onClick={() => updateFilter({ modifiers: active ? (filter.modifiers || []).filter((item) => item !== modifier) : [...(filter.modifiers || []), modifier] })}>{modifier.toUpperCase()}</button>;
            })}
          </div>
          <small style={{ display: 'block', color: '#64748b', marginTop: 8 }}>คลิกช่องแล้วกดคีย์ที่ต้องการจับค่าอัตโนมัติ</small>
            </>
          )}
        </>
      );
    }

    if (eventOption.filterKind === 'hotkey') {
      return (
        <>
          <ToggleChoice label="ทุก Hotkey" active={filter.kind === 'any'} onClick={() => updateFilter({ kind: 'any', value: '', modifiers: [] })} />
          <ToggleChoice label="Hotkey ที่เลือก" active={filter.kind === 'hotkey'} onClick={() => updateFilter({ kind: 'hotkey', value: filter.value || OBS_HOTKEY_OPTIONS[0].value })} />
          {filter.kind === 'hotkey' && <select style={fieldStyle()} value={filter.value || ''} onChange={(e) => updateFilter({ value: e.target.value })}>{OBS_HOTKEY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}
        </>
      );
    }

    const isScene = eventOption.filterKind === 'scene';
    const isMediaInputEvent = event === 'MediaInputPlaybackStarted' || event === 'MediaInputPlaybackEnded';
    const filterOptions = isScene ? scenes : (isMediaInputEvent ? mediaInputs : sourceOptions);
    return (
      <>
        <ToggleChoice label="ทุกครั้ง" active={filter.kind === 'any'} onClick={() => updateFilter({ kind: 'any', value: '', modifiers: [] })} />
        <ToggleChoice label={isScene ? 'Scene ที่เลือก' : (isMediaInputEvent ? 'Media Input ที่เลือก' : 'Source ที่เลือก')} active={filter.kind === eventOption.filterKind} onClick={() => updateFilter({ kind: eventOption.filterKind, value: filter.value || '', modifiers: [] })} />
        {filter.kind !== 'any' && (filterOptions.length > 0 ? <select style={fieldStyle()} value={filter.value || ''} onChange={(e) => updateFilter({ value: e.target.value })}>
            <option value="">เลือก...</option>
            {filterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select> : <input style={fieldStyle()} value={filter.value || ''} placeholder={isScene ? 'พิมพ์ชื่อ Scene' : (isMediaInputEvent ? 'พิมพ์ชื่อ Media Input' : 'พิมพ์ชื่อ Source')} onChange={(e) => updateFilter({ value: e.target.value })} />)}
      </>
    );
  };

  const renderActionFields = (action: ActionStep) => {
    if (action.type === 'wait') {
      return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="number" min="0" step="0.1" style={{ ...fieldStyle(), maxWidth: 140 }} value={(action.delayMs ?? 1000) / 1000} onChange={(e) => updateAction(action.id, { delayMs: Math.max(0, Number(e.target.value) * 1000) })} /><span style={{ color: '#94a3b8' }}>วินาที</span></div>;
    }
    if (action.type === 'switchScene') {
      return scenes.length > 0 ? <select style={fieldStyle()} value={action.sceneName || ''} onChange={(e) => updateAction(action.id, { sceneName: e.target.value })}><option value="">เลือก Scene...</option>{scenes.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input style={fieldStyle()} value={action.sceneName || ''} placeholder="พิมพ์ชื่อ Scene" onChange={(e) => updateAction(action.id, { sceneName: e.target.value })} />;
    }
    if (action.type === 'showSource' || action.type === 'hideSource') {
      const availableSources = action.sourceScene ? sceneItemsMap[action.sourceScene] || sourceOptions : sourceOptions;
      return <div style={{ display: 'grid', gap: 8 }}>{scenes.length > 0 ? <select style={fieldStyle()} value={action.sourceScene || ''} onChange={(e) => updateAction(action.id, { sourceScene: e.target.value, sourceName: '' })}><option value="">เลือก Scene...</option>{scenes.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input style={fieldStyle()} value={action.sourceScene || ''} placeholder="พิมพ์ชื่อ Scene" onChange={(e) => updateAction(action.id, { sourceScene: e.target.value })} />}{availableSources.length > 0 ? <select style={fieldStyle()} value={action.sourceName || ''} onChange={(e) => updateAction(action.id, { sourceName: e.target.value })}><option value="">เลือก Source...</option>{availableSources.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input style={fieldStyle()} value={action.sourceName || ''} placeholder="พิมพ์ชื่อ Source" onChange={(e) => updateAction(action.id, { sourceName: e.target.value })} />}</div>;
    }
    return <div style={{ color: '#6ee7b7', fontSize: '0.82rem' }}>ขั้นตอนนี้พร้อมใช้งาน ไม่ต้องตั้งค่าเพิ่ม</div>;
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h3 style={{ margin: 0 }}>สร้าง Automation</h3><div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 5 }}>ตั้งค่าแบบง่าย: เมื่อเกิดอะไรขึ้น → ให้ทำอะไร</div></div>
          <button type="button" style={{ ...buttonStyle(), fontSize: '1.2rem', padding: '2px 9px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', padding: '14px 24px', gap: 8, borderBottom: '1px solid #1e293b' }}>
          {['ตั้งชื่อ', 'เลือกเหตุการณ์', 'กำหนดขั้นตอน'].map((label, index) => <button key={label} type="button" disabled={index > step} onClick={() => goTo(index)} style={{ ...buttonStyle(index === step), flex: 1, opacity: index <= step ? 1 : 0.55 }}>{index + 1}. {label}</button>)}
        </div>
        <div style={{ padding: 24 }}>
          {step === 0 && <div style={{ display: 'grid', gap: 18 }}><label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>ชื่อ Automation<input autoFocus style={{ ...fieldStyle(), marginTop: 7 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น VAR Replay อัตโนมัติ" /></label><div><div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: 8 }}>สีประจำรายการ</div><div style={{ display: 'flex', gap: 9 }}>{PRESET_COLORS.map((item) => <button key={item} type="button" aria-label={item} onClick={() => setColor(item)} style={{ width: 28, height: 28, borderRadius: '50%', border: color === item ? '3px solid #fff' : '2px solid transparent', background: item, cursor: 'pointer' }} />)}</div></div></div>}
          {step === 1 && <div style={{ display: 'grid', gap: 16 }}><div><label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: 7 }}>ทำงานเมื่อเกิดเหตุการณ์นี้</label><select style={fieldStyle()} value={event} onChange={(e) => selectEvent(e.target.value as MacroEvent)}>{(['scoreboard', 'obs', 'keyboard'] as const).map((category) => <optgroup key={category} label={CATEGORY_LABELS[category]}>{MACRO_EVENT_OPTIONS.filter((item) => item.category === category).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select><div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 7 }}>{eventOption.description}</div></div><div style={{ padding: 14, background: '#1e293b', borderRadius: 8, display: 'grid', gap: 10 }}><div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>เลือกเงื่อนไขเพิ่มเติม <span style={{ color: '#64748b' }}>(ถ้ามี)</span></div>{renderTriggerFilter()}</div></div>}
          {step === 2 && <div style={{ display: 'grid', gap: 14 }}><div style={{ padding: 14, background: '#064e3b', borderRadius: 8, color: '#a7f3d0', fontSize: '0.85rem' }}><strong>{name || 'Automation ใหม่'}</strong><br />{eventOption.label}{filter.kind !== 'any' && filter.value ? `: ${filter.value}` : ''}</div>{actions.map((action, index) => <div key={action.id} style={{ padding: 14, border: '1px solid #334155', borderRadius: 8, background: '#1e293b' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ width: 25, height: 25, borderRadius: '50%', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{index + 1}</span><select style={{ ...fieldStyle(), flex: 1 }} value={action.type} onChange={(e) => handleActionTypeChange(action.id, e)}>{ACTION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" title="เลื่อนขึ้น" style={buttonStyle()} onClick={() => moveAction(index, -1)} disabled={index === 0}>↑</button><button type="button" title="เลื่อนลง" style={buttonStyle()} onClick={() => moveAction(index, 1)} disabled={index === actions.length - 1}>↓</button><button type="button" title="ลบขั้นตอน" style={{ ...buttonStyle(), color: '#fca5a5' }} onClick={() => removeAction(action.id)}>×</button></div>{renderActionFields(action)}</div>)}<select style={fieldStyle()} value="" onChange={handleAddAction}><option value="">+ เพิ่มขั้นตอน</option>{ACTION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><div style={{ padding: 14, background: '#0f172a', borderRadius: 8, color: '#cbd5e1', fontSize: '0.82rem' }}><strong>ตัวอย่างการทำงาน</strong><div style={{ marginTop: 7 }}>เมื่อ {eventOption.label.toLowerCase()} ระบบจะ:</div>{actions.map((action, index) => <div key={action.id} style={{ marginTop: 4 }}>{index + 1}. {describeAction(action)}</div>)}</div></div>}
          {isLoadingObs && <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 12 }}>กำลังโหลดรายการจาก OBS...</div>}
          {error && <div style={{ color: '#fca5a5', background: '#450a0a', padding: 10, borderRadius: 7, marginTop: 14, fontSize: '0.82rem' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', gap: 8 }}><button type="button" style={buttonStyle()} onClick={() => step === 0 ? onClose() : goTo(step - 1)}>{step === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}</button>{step < 2 ? <button type="button" style={buttonStyle(true)} onClick={() => goTo(step + 1)}>ถัดไป</button> : <button type="button" style={buttonStyle(true)} onClick={save}>บันทึก Automation</button>}</div>
      </div>
    </div>
  );
}

function ToggleChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ ...buttonStyle(active), marginRight: 8, marginBottom: 8, background: active ? '#0284c7' : '#334155' }}>{active ? '● ' : '○ '}{label}</button>;
}
