import { useState } from 'react';
import { USAGE_GUIDE_SECTIONS } from '../config/usageGuide';
import type { UsageGuideSectionId } from '../types/usageGuide';
import ModalBackdrop from './ModalBackdrop';
import ModalCloseButton from './ModalCloseButton';
import UiIcon from './UiIcon';
import './UsageGuideModal.css';

interface UsageGuideModalProps {
  onClose: () => void;
}

export default function UsageGuideModal({ onClose }: UsageGuideModalProps) {
  const [activeSectionId, setActiveSectionId] = useState<UsageGuideSectionId>('getting-started');
  const activeSection = USAGE_GUIDE_SECTIONS.find((section) => section.id === activeSectionId)
    ?? USAGE_GUIDE_SECTIONS[0];

  return (
    <ModalBackdrop className="usage-guide-backdrop" onEscape={onClose}>
      <section className="usage-guide-modal" role="dialog" aria-modal="true" aria-labelledby="usage-guide-title">
        <ModalCloseButton onClose={onClose} />
        <header className="usage-guide-modal__header">
          <div className="usage-guide-modal__icon" aria-hidden="true"><UiIcon name="bookOpen" /></div>
          <div>
            <h2 id="usage-guide-title">วิธีการใช้งาน MatchFlow Studio</h2>
            <p>คู่มือเริ่มต้นสำหรับการจัดการและถ่ายทอดการแข่งขันฟุตบอล</p>
          </div>
        </header>

        <nav className="usage-guide-modal__tabs" aria-label="หมวดคู่มือการใช้งาน">
          {USAGE_GUIDE_SECTIONS.map((section, index) => (
            <button
              key={section.id}
              type="button"
              className={section.id === activeSection.id ? 'is-active' : undefined}
              onClick={() => setActiveSectionId(section.id)}
              aria-current={section.id === activeSection.id ? 'page' : undefined}
            >
              <span>{index + 1}</span>
              {section.title}
            </button>
          ))}
        </nav>

        <article className="usage-guide-modal__content" aria-live="polite">
          <p className="usage-guide-modal__eyebrow">หมวดที่ {USAGE_GUIDE_SECTIONS.findIndex((section) => section.id === activeSection.id) + 1}</p>
          <h3>{activeSection.title}</h3>
          <p className="usage-guide-modal__description">{activeSection.description}</p>

          <ol className="usage-guide-modal__steps">
            {activeSection.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>

          <aside className="usage-guide-modal__tip">
            <UiIcon name="info" size="1.1em" />
            <div><strong>ข้อควรระวัง</strong><span>{activeSection.tip}</span></div>
          </aside>

          {activeSection.video && (
            <a
              className="usage-guide-modal__video"
              href={activeSection.video.url}
              target="_blank"
              rel="noreferrer"
            >
              <UiIcon name="playCircle" />
              {activeSection.video.label}
            </a>
          )}
        </article>

        <footer className="usage-guide-modal__footer">
          <span>วิดีโอสอนใช้งานจะแสดงในแต่ละหมวดเมื่อมีการเพิ่มลิงก์</span>
          <button type="button" className="btn-secondary" onClick={onClose}>ปิดคู่มือ</button>
        </footer>
      </section>
    </ModalBackdrop>
  );
}
