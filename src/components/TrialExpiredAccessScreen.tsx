import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import AdminContactMethods from './AdminContactMethods';
import ModalBackdrop from './ModalBackdrop';
import ModalCloseButton from './ModalCloseButton';
import UiIcon from './UiIcon';
import UserAvatar from './UserAvatar';

interface TrialExpiredAccessScreenProps {
  user: User;
  reason: string | null;
  isCheckingAccess: boolean;
  onRecheckAccess: () => void;
  onLogout: () => void;
}

export default function TrialExpiredAccessScreen({
  user,
  reason,
  isCheckingAccess,
  onRecheckAccess,
  onLogout,
}: TrialExpiredAccessScreenProps) {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(true);

  return (
    <div className="trial-expired-screen">
      <main className="trial-expired-card">
        <div className="trial-expired-card__icon" aria-hidden="true">⌛</div>
        <h1>ทดลองใช้ฟรีหมดอายุแล้ว</h1>
        <p className="trial-expired-card__intro">
          หากต้องการใช้งาน <strong>MatchFlow Studio</strong> ต่อ กรุณาติดต่อ Admin เพื่อขอสิทธิ์ VIP
        </p>

        <div className="trial-expired-user">
          <UserAvatar user={user} size={40} />
          <span>{user.email}</span>
        </div>

        <section className="trial-expired-contact-card" aria-labelledby="trial-expired-contact-title">
          <div className="trial-expired-contact-card__heading">
            <UiIcon name="crown" size="1.05em" />
            <h2 id="trial-expired-contact-title">ติดต่อ Admin เพื่อขอสิทธิ์ VIP</h2>
          </div>
          <p>แจ้งอีเมลที่ใช้เข้าสู่ระบบกับ Admin เพื่อดำเนินการอนุมัติ Whitelist</p>
          <AdminContactMethods />
        </section>

        {reason && <p className="trial-expired-reason" role="status">{reason}</p>}

        <div className="trial-expired-card__actions">
          <button
            type="button"
            className="trial-expired-recheck-button"
            onClick={onRecheckAccess}
            disabled={isCheckingAccess}
          >
            {isCheckingAccess ? 'กำลังตรวจสอบสิทธิ์...' : 'ฉันได้รับอนุมัติแล้ว — ตรวจสอบสิทธิ์อีกครั้ง'}
          </button>
          <button type="button" className="trial-expired-logout-button" onClick={onLogout} disabled={isCheckingAccess}>
            ลงชื่อเข้าใช้ด้วยบัญชีอื่น
          </button>
        </div>
      </main>

      {isContactDialogOpen && (
        <ModalBackdrop className="trial-expired-dialog-backdrop" onEscape={() => setIsContactDialogOpen(false)}>
          <section className="trial-expired-dialog" role="dialog" aria-modal="true" aria-labelledby="trial-expired-dialog-title">
            <ModalCloseButton onClose={() => setIsContactDialogOpen(false)} />
            <div className="trial-expired-dialog__icon" aria-hidden="true">🎁</div>
            <h2 id="trial-expired-dialog-title">ต้องการใช้งาน MatchFlow Studio ต่อหรือไม่?</h2>
            <p>ติดต่อ Admin เพื่อขอสิทธิ์ VIP ได้ตามช่องทางด้านล่าง</p>
            <AdminContactMethods />
            <button type="button" className="trial-expired-dialog__close" onClick={() => setIsContactDialogOpen(false)}>
              รับทราบ
            </button>
          </section>
        </ModalBackdrop>
      )}
    </div>
  );
}
