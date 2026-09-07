import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { League, Team } from '../../config/supabaseClient';
import type { LeagueLogoSizingSettings } from '../../types/leagueLogoSizing';
import LeagueLogoScaleControls from './LeagueLogoScaleControls';
import ModalBackdrop from '../ModalBackdrop';

interface LeagueLogoScaleModalProps {
  isOpen: boolean;
  league: League;
  teams: Team[];
  disabled?: boolean;
  onUpdateLeague: (leagueId: string, updates: Partial<League>) => Promise<League | null>;
  onPreviewSizingChange?: (sizing: LeagueLogoSizingSettings | null) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export default function LeagueLogoScaleModal({
  isOpen,
  league,
  teams,
  disabled = false,
  onUpdateLeague,
  onPreviewSizingChange,
  onClose,
  returnFocusRef,
}: LeagueLogoScaleModalProps) {
  const [isDirty, setIsDirty] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const requestClose = () => {
    if (isDirty && !window.confirm('มีการแก้ไขขนาดโลโก้ที่ยังไม่ได้บันทึก ต้องการปิดและยกเลิกการแก้ไขหรือไม่?')) {
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return undefined;
    returnFocusRef?.current?.focus();
    return undefined;
  }, [isOpen, returnFocusRef]);

  if (!isOpen) return null;

  const modal = (
    <ModalBackdrop
      className="league-logo-scale-modal-overlay"
      onEscape={requestClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="league-logo-scale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-logo-scale-modal-title"
        tabIndex={-1}
      >
        <div className="league-logo-scale-modal-header">
          <div>
            <h2 id="league-logo-scale-modal-title">
              <i className="fas fa-expand-arrows-alt" aria-hidden="true" />
              ขนาดโลโก้เริ่มต้นของลีก
            </h2>
            <p>{league.name}</p>
          </div>
          <button type="button" className="league-modal-close" onClick={requestClose} aria-label="ปิดหน้าต่าง">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="league-logo-scale-modal-body">
          <LeagueLogoScaleControls
            key={league.id}
            league={league}
            teams={teams}
            disabled={disabled}
            onUpdateLeague={onUpdateLeague}
            onPreviewSizingChange={onPreviewSizingChange}
            onDirtyChange={setIsDirty}
            onCancel={onClose}
          />
        </div>
      </div>
    </ModalBackdrop>
  );

  return createPortal(modal, document.body);
}
