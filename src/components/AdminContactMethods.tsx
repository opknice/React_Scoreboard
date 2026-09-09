import { useCallback, useEffect, useState } from 'react';
import { ADMIN_CONTACT } from '../config/adminContact';
import { copyToClipboard } from '../utils/copyToClipboard';

interface AdminContactMethodsProps {
  userEmail?: string;
  showLineQr?: boolean;
}

type CopyTarget = 'line' | 'user-email' | null;
type CopyStatus = 'idle' | 'success' | 'error';

export default function AdminContactMethods({ userEmail, showLineQr = false }: AdminContactMethodsProps) {
  const [copyTarget, setCopyTarget] = useState<CopyTarget>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (copyTarget === null) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCopyTarget(null);
      setCopyStatus('idle');
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [copyTarget]);

  const copyValue = useCallback(async (target: Exclude<CopyTarget, null>, value: string) => {
    try {
      await copyToClipboard(value);
      setCopyTarget(target);
      setCopyStatus('success');
    } catch {
      setCopyTarget(target);
      setCopyStatus('error');
    }
  }, []);

  const getCopyHint = (target: Exclude<CopyTarget, null>, defaultHint: string): string => {
    if (copyTarget !== target) return defaultHint;
    return copyStatus === 'success' ? 'คัดลอกแล้ว' : 'กรุณาคัดลอกเอง';
  };

  return (
    <div className="admin-contact-methods">
      {userEmail && (
        <button
          type="button"
          className="admin-contact-account"
          onClick={() => void copyValue('user-email', userEmail)}
          aria-label={`คัดลอกอีเมล ${userEmail}`}
        >
          <span>อีเมลที่ใช้เข้าสู่ระบบ</span>
          <strong>{userEmail}</strong>
          <small>{getCopyHint('user-email', 'คัดลอกอีเมล')}</small>
        </button>
      )}

      {showLineQr && (
        <section className="admin-contact-line-qr" aria-labelledby="admin-contact-line-qr-title">
          <img src={ADMIN_CONTACT.lineQrImage} alt="QR Code สำหรับเพิ่มเพื่อน LINE Admin" width="116" height="116" />
          <div>
            <strong id="admin-contact-line-qr-title">เพิ่มเพื่อนทาง LINE</strong>
            <span>LINE ID: {ADMIN_CONTACT.lineId}</span>
            <div className="admin-contact-line-qr__actions">
              <a href={ADMIN_CONTACT.lineUrl} target="_blank" rel="noreferrer">เปิด LINE</a>
              <button type="button" onClick={() => void copyValue('line', ADMIN_CONTACT.lineId)}>
                {getCopyHint('line', 'คัดลอก LINE ID')}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="admin-contact-actions">
        {!showLineQr && (
          <a className="admin-contact-action" href={ADMIN_CONTACT.lineUrl} target="_blank" rel="noreferrer">
            <span className="admin-contact-action__label">LINE</span>
            <span className="admin-contact-action__value">{ADMIN_CONTACT.lineId}</span>
            <span className="admin-contact-action__hint">เปิด LINE</span>
          </a>
        )}
        <a className="admin-contact-action" href={ADMIN_CONTACT.facebookUrl} target="_blank" rel="noreferrer">
          <span className="admin-contact-action__label">Facebook</span>
          <span className="admin-contact-action__value">thanakrit.nice</span>
          <span className="admin-contact-action__hint">เปิดหน้า</span>
        </a>
        <a className="admin-contact-action" href={ADMIN_CONTACT.phoneHref}>
          <span className="admin-contact-action__label">โทรศัพท์</span>
          <span className="admin-contact-action__value">{ADMIN_CONTACT.phoneDisplay}</span>
          <span className="admin-contact-action__hint">โทร</span>
        </a>
        <a className="admin-contact-action" href={`mailto:${ADMIN_CONTACT.email}`}>
          <span className="admin-contact-action__label">Email</span>
          <span className="admin-contact-action__value">{ADMIN_CONTACT.email}</span>
          <span className="admin-contact-action__hint">ส่งอีเมล</span>
        </a>
      </div>
    </div>
  );
}
