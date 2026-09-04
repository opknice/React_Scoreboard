export default function ScoreboardLazyFallback() {
  return (
    <div className="modal-overlay" role="status" aria-live="polite" aria-label="กำลังโหลดหน้าต่าง">
      <div className="modal-content" style={{ maxWidth: '360px', textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin" aria-hidden="true" />{' '}
        กำลังโหลดข้อมูล...
      </div>
    </div>
  );
}
