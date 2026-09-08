import UiIcon from '../UiIcon';
import ModalBackdrop from '../ModalBackdrop';
import ModalCloseButton from '../ModalCloseButton';

export default function ScoreboardLazyFallback({ onClose }: { onClose: () => void }) {
  return (
    <ModalBackdrop className="modal-overlay" onEscape={onClose}>
      <div className="modal-content" style={{ maxWidth: '360px', textAlign: 'center' }}>
        <ModalCloseButton onClose={onClose} />
        <div role="status" aria-live="polite" aria-label="กำลังโหลดหน้าต่าง">
        <UiIcon name="spinner" />{' '}
        กำลังโหลดข้อมูล...
        </div>
      </div>
    </ModalBackdrop>
  );
}
