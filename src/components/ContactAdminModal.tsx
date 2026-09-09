import AdminContactMethods from './AdminContactMethods';
import ModalBackdrop from './ModalBackdrop';
import ModalCloseButton from './ModalCloseButton';
import UiIcon from './UiIcon';
import './ContactAdminModal.css';

interface ContactAdminModalProps {
  userEmail: string;
  onClose: () => void;
}

export default function ContactAdminModal({ userEmail, onClose }: ContactAdminModalProps) {
  return (
    <ModalBackdrop className="contact-admin-backdrop" onEscape={onClose}>
      <section className="contact-admin-modal" role="dialog" aria-modal="true" aria-labelledby="contact-admin-title">
        <ModalCloseButton onClose={onClose} />
        <header className="contact-admin-modal__header">
          <div className="contact-admin-modal__icon" aria-hidden="true"><UiIcon name="messageCircle" /></div>
          <div>
            <h2 id="contact-admin-title">ติดต่อ Admin</h2>
            <p>ขอสิทธิ์ VIP, แจ้งปัญหาการใช้งาน หรือสอบถามการตั้งค่า MatchFlow Studio</p>
          </div>
        </header>

        <div className="contact-admin-modal__content">
          <p className="contact-admin-modal__instruction">
            กรุณาแจ้งอีเมลที่ใช้เข้าสู่ระบบกับ Admin เพื่อให้ตรวจสอบสิทธิ์และช่วยเหลือได้รวดเร็วขึ้น
          </p>
          <AdminContactMethods userEmail={userEmail} showLineQr />
        </div>

        <footer className="contact-admin-modal__footer">
          <span>เลือกช่องทางที่สะดวกสำหรับคุณ</span>
          <button type="button" className="btn-secondary" onClick={onClose}>ปิด</button>
        </footer>
      </section>
    </ModalBackdrop>
  );
}
