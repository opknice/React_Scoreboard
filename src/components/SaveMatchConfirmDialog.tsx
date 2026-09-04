import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './SaveMatchConfirmDialog.css';

export interface SaveMatchConfirmDialogProps {
  isOpen: boolean;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Confirmation dialog for saving one match result.
 * Its CSS is imported statically so it never depends on a lazy-loaded modal.
 */
export default function SaveMatchConfirmDialog({
  isOpen,
  teamAName,
  teamBName,
  scoreA,
  scoreB,
  onConfirm,
  onClose,
}: SaveMatchConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const isConfirmingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;

    try {
      void Promise.resolve(onConfirm()).finally(() => {
        isConfirmingRef.current = false;
      });
    } catch (error: unknown) {
      isConfirmingRef.current = false;
      throw error;
    }
  };

  return createPortal(
    <div
      className="save-match-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="save-match-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="save-match-confirm-header">
          <h3 id={titleId}>
            <i className="fas fa-save" aria-hidden="true" />
            ยืนยันการบันทึก
          </h3>
          <button
            className="save-match-confirm-close"
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างยืนยันการบันทึก"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        <div className="save-match-confirm-body">
          <div className="save-match-confirm-summary">
            <span>({teamAName})  {scoreA} - {scoreB}  ({teamBName})</span>
          </div>

          <div className="save-match-confirm-actions">
            <button className="save-match-confirm-primary" type="button" onClick={handleConfirm} autoFocus>
              <i className="fas fa-check" aria-hidden="true" />
              ยืนยัน
            </button>
            <button className="save-match-confirm-cancel" type="button" onClick={onClose}>
              <i className="fas fa-times" aria-hidden="true" />
              ยกเลิก
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
