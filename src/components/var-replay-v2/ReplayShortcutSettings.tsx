import { useEffect, useState } from 'react';
import {
  createReplayBindingFromEvent,
  findReplayBindingConflict,
  formatReplayBinding,
  REPLAY_SHORTCUT_DEFINITIONS,
  type ReplayKeyBinding,
  type ReplayShortcutAction,
} from './varReplayKeybindings';
import styles from './VarReplayV2.module.css';

type ReplayShortcutSettingsProps = {
  bindings: ReplayKeyBinding[];
  onUpdate: (binding: ReplayKeyBinding) => void;
  onClear: (action: ReplayShortcutAction) => void;
  onReset: () => void;
};

export default function ReplayShortcutSettings({ bindings, onUpdate, onClear, onReset }: ReplayShortcutSettingsProps) {
  const [capturingAction, setCapturingAction] = useState<ReplayShortcutAction | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!capturingAction) return undefined;

    const handleCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setCapturingAction(null);
        setMessage('ยกเลิกการกำหนดปุ่ม');
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        onClear(capturingAction);
        setCapturingAction(null);
        setMessage('ล้างปุ่มลัดแล้ว');
        return;
      }

      const nextBinding = createReplayBindingFromEvent(capturingAction, event);
      if (!nextBinding) {
        setMessage('กรุณาเลือกปุ่มคำสั่ง ไม่ใช่ปุ่ม Modifier เดี่ยว ๆ');
        return;
      }

      const conflictAction = findReplayBindingConflict(bindings, nextBinding, capturingAction);
      if (conflictAction) {
        const conflictLabel = REPLAY_SHORTCUT_DEFINITIONS.find((item) => item.action === conflictAction)?.label || conflictAction;
        setMessage(`ปุ่มนี้ถูกใช้กับ “${conflictLabel}” แล้ว`);
        return;
      }

      onUpdate(nextBinding);
      setCapturingAction(null);
      setMessage(`บันทึกปุ่ม ${formatReplayBinding(nextBinding)} แล้ว`);
    };

    window.addEventListener('keydown', handleCapture, true);
    return () => window.removeEventListener('keydown', handleCapture, true);
  }, [bindings, capturingAction, onClear, onUpdate]);

  const startCapture = (action: ReplayShortcutAction) => {
    setCapturingAction(action);
    setMessage('กดปุ่มที่ต้องการ · Escape ยกเลิก · Delete ล้างปุ่ม');
  };

  return (
    <details className={styles.shortcutSettings}>
      <summary>ตั้งค่าปุ่มลัด Keyboard</summary>
      <div className={styles.shortcutToolbar}>
        <span>กำหนดปุ่มควบคุม Replay ได้ตามรูปแบบการทำงานของคุณ</span>
        <button className={styles.secondaryButton} type="button" onClick={onReset}>รีเซ็ตค่าเริ่มต้น</button>
      </div>
      <div className={styles.shortcutList}>
        {REPLAY_SHORTCUT_DEFINITIONS.map((definition) => {
          const binding = bindings.find((item) => item.action === definition.action);
          const isCapturing = capturingAction === definition.action;
          return (
            <div className={styles.shortcutRow} key={definition.action}>
              <div className={styles.shortcutDescription}>
                <strong>{definition.label}</strong>
                <small>{definition.description}</small>
              </div>
              <kbd className={styles.shortcutValue}>{formatReplayBinding(binding)}</kbd>
              <button
                className={`${styles.secondaryButton} ${isCapturing ? styles.captureButton : ''}`}
                type="button"
                onClick={() => startCapture(definition.action)}
              >
                {isCapturing ? 'กดปุ่ม...' : 'กำหนดปุ่ม'}
              </button>
              <button
                className={styles.shortcutClearButton}
                type="button"
                aria-label={`ล้างปุ่ม ${definition.label}`}
                title="ล้างปุ่มลัด"
                onClick={() => { onClear(definition.action); setMessage(`ล้างปุ่มของ ${definition.label} แล้ว`); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {message && <div className={styles.shortcutMessage} role="status">{message}</div>}
    </details>
  );
}
