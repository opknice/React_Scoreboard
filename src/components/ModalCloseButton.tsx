import './ModalCloseButton.css';

export default function ModalCloseButton({ onClose, disabled = false }: {
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="modal-corner-close" onClick={onClose} disabled={disabled} aria-label="ปิดหน้าต่าง" title="ปิด">
      <span aria-hidden="true">×</span>
    </button>
  );
}
