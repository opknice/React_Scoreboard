import ModalCloseButton from './ModalCloseButton';
import ModalBackdrop from './ModalBackdrop';
import type { TranslationSet } from '../constants/translations';

interface ScoreboardInfoModalsProps {
  trans: Pick<TranslationSet, 'close' | 'donateThai' | 'donateTitle' | 'changelogContent' | 'changelogTitle'>;
  showDonate: boolean;
  showChangelog: boolean;
  onCloseDonate: () => void;
  onCloseChangelog: () => void;
}

export default function ScoreboardInfoModals({
  trans,
  showDonate,
  showChangelog,
  onCloseDonate,
  onCloseChangelog,
}: ScoreboardInfoModalsProps) {
  return (
    <>
      {showDonate && (
        <ModalBackdrop className="modal-overlay" onEscape={onCloseDonate}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClose={onCloseDonate} />
            <h3><i className="fas fa-hand-holding-usd"></i> {trans.donateTitle}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div>{trans.donateThai}</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://easydonate.app/Jamornz" alt="QR สำหรับสนับสนุนโครงการ" />
              <a href="https://easydonate.app/Jamornz" target="_blank" rel="noreferrer">https://easydonate.app/Jamornz</a>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onCloseDonate}>{trans.close}</button></div>
          </div>
        </ModalBackdrop>
      )}

      {showChangelog && (
        <ModalBackdrop className="modal-overlay" onEscape={onCloseChangelog}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '600px' }}>
            <ModalCloseButton onClose={onCloseChangelog} />
            <h3><i className="fas fa-history"></i> {trans.changelogTitle || 'Changelog'}</h3>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: trans.changelogContent || '<p>No changelog available.</p>' }} />
            <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-primary" onClick={onCloseChangelog}>{trans.close}</button></div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
