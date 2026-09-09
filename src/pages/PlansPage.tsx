import { useNavigate } from 'react-router-dom';
import AdminContactMethods from '../components/AdminContactMethods';
import UiIcon from '../components/UiIcon';
import { ACCESS_PLAN_FEATURE_GROUPS, ACCESS_PLAN_SUMMARIES } from '../config/accessPlans';
import { useAuthAccess } from '../hooks/useAuthAccess';
import { useTrialRemainingLabel } from '../hooks/useTrialRemainingLabel';
import './PlansPage.css';

function AvailabilityMark({ available }: { available: boolean }) {
  return (
    <span className={`plans-availability ${available ? 'is-available' : 'is-unavailable'}`} aria-hidden="true">
      {available ? '✓' : '—'}
    </span>
  );
}

export default function PlansPage() {
  const navigate = useNavigate();
  const authAccess = useAuthAccess();
  const isTrial = authAccess?.accessType === 'trial';
  const isVip = authAccess?.accessType === 'whitelist' || authAccess?.accessType === 'super-admin';
  const currentPlanLabel = isTrial ? 'Free Trial' : isVip ? 'VIP' : 'ยังไม่มีแพ็กเกจที่ใช้งานอยู่';
  const trialRemaining = useTrialRemainingLabel(authAccess?.trialExpiresAt);

  const scrollToContact = () => {
    document.getElementById('plans-contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="plans-page">
      {/* Decorative artwork uses the deployment base path, including GitHub Pages. */}
      <div className="plans-page__artwork" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}MatchFlowStudio.png`}
          alt=""
          width="1254"
          height="1254"
          decoding="async"
          draggable={false}
        />
      </div>
      <div className="plans-page__glow plans-page__glow--blue" aria-hidden="true" />
      <div className="plans-page__glow plans-page__glow--gold" aria-hidden="true" />

      <nav className="plans-nav" aria-label="เมนูหน้าแพ็กเกจ">
        <button type="button" className="plans-back-button" onClick={() => navigate('/')}>
          <UiIcon name="arrowLeft" /> กลับหน้า Controller
        </button>
        <div className="plans-brand">
          <span className="plans-brand__mark">MF</span>
          <span><strong>MatchFlow</strong> Studio</span>
        </div>
        <span className={`plans-current-plan ${isVip ? 'is-vip' : 'is-trial'}`}>
          <span className="plans-current-plan__dot" /> แพ็กเกจปัจจุบัน: {currentPlanLabel}
        </span>
      </nav>

      <section className="plans-hero" aria-labelledby="plans-title">
        <span className="plans-hero__eyebrow">เลือกสิทธิ์ที่เหมาะกับงานถ่ายทอดของคุณ</span>
        <h1 id="plans-title">ทดลองทุกฟีเจอร์หลัก<br /><span>แล้วใช้งานต่อแบบ VIP</span></h1>
        <p>
          Free Trial และ VIP ใช้ชุดเครื่องมือควบคุมการแข่งขันเดียวกัน
          ความแตกต่างหลักคือระยะเวลาและโควตาอัปโหลดรูปภาพ
        </p>
        {isTrial && trialRemaining && (
          <div className="plans-trial-clock" role="status">
            <span aria-hidden="true">⏳</span>
            <div><small>ระยะเวลาทดลองของคุณ</small><strong>{trialRemaining}</strong></div>
          </div>
        )}
      </section>

      <section className="plans-cards" aria-label="แพ็กเกจ MatchFlow Studio">
        {ACCESS_PLAN_SUMMARIES.map((plan) => {
          const isCurrent = (plan.id === 'trial' && isTrial) || (plan.id === 'vip' && isVip);
          return (
            <article key={plan.id} className={`plans-card plans-card--${plan.id} ${isCurrent ? 'is-current' : ''}`}>
              {plan.recommended && <span className="plans-card__recommended">แนะนำสำหรับถ่ายทอดจริง</span>}
              <div className="plans-card__heading">
                <div className="plans-card__icon" aria-hidden="true">{plan.id === 'trial' ? '🎁' : '♛'}</div>
                <div><span>{plan.eyebrow}</span><h2>{plan.name}</h2></div>
              </div>
              <p className="plans-card__description">{plan.description}</p>
              <dl className="plans-card__facts">
                <div><dt>ระยะเวลา</dt><dd>{plan.duration}</dd></div>
                <div><dt>โลโก้/รูปทั่วไป</dt><dd>{plan.logoUploadLimit}</dd></div>
                <div><dt>รูปนักเตะ</dt><dd>{plan.playerImageUploadLimit}</dd></div>
              </dl>
              {plan.id === 'trial' ? (
                <div className="plans-card__action plans-card__action--trial">
                  {isTrial ? `กำลังใช้งาน${trialRemaining ? ` · ${trialRemaining}` : ''}` : 'สิทธิ์ทดลองสำหรับผู้ใช้ใหม่'}
                </div>
              ) : (
                <button type="button" className="plans-card__action plans-card__action--vip" onClick={scrollToContact}>
                  {isVip ? 'คุณเป็นสมาชิก VIP แล้ว' : 'ติดต่อ Admin เพื่อขอ VIP'}
                  <UiIcon name="arrowDown" />
                </button>
              )}
              {isCurrent && <span className="plans-card__current-badge">แพ็กเกจของคุณ</span>}
            </article>
          );
        })}
      </section>

      <section className="plans-comparison" aria-labelledby="plans-comparison-title">
        <div className="plans-section-heading">
          <span>เปรียบเทียบแบบละเอียด</span>
          <h2 id="plans-comparison-title">ฟีเจอร์ที่ได้รับในแต่ละสิทธิ์</h2>
          <p>ข้อมูลนี้อ้างอิงจากข้อจำกัดที่ระบบบังคับใช้ในปัจจุบัน</p>
        </div>

        <div className="plans-comparison__table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">ฟีเจอร์</th>
                <th scope="col"><span className="plans-column-label plans-column-label--trial">🎁 Free Trial</span></th>
                <th scope="col"><span className="plans-column-label plans-column-label--vip">♛ VIP</span></th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_PLAN_FEATURE_GROUPS.map((group) => (
                <FragmentRows key={group.title} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="plans-notes" aria-labelledby="plans-notes-title">
        <div className="plans-section-heading plans-section-heading--left">
          <span>ควรรู้ก่อนใช้งาน</span>
          <h2 id="plans-notes-title">เงื่อนไขที่เหมือนกันทั้งสองแพ็กเกจ</h2>
        </div>
        <div className="plans-notes__grid">
          <article><span>01</span><div><h3>เข้าสู่ระบบด้วย Google</h3><p>ทุกบัญชีต้องผ่าน Supabase Authentication ก่อนเปิดแผงควบคุม</p></div></article>
          <article><span>02</span><div><h3>เชื่อมต่ออุปกรณ์ให้พร้อม</h3><p>Replay, VAR และคำสั่ง OBS ต้องใช้โฟลเดอร์วิดีโอและ OBS WebSocket</p></div></article>
          <article><span>03</span><div><h3>Public Views สำหรับ OBS</h3><p>URL แสดงผลยังเปิดแบบ Public เพื่อให้ Browser Source ทำงานโดยไม่ต้อง Login</p></div></article>
          <article><span>04</span><div><h3>VIP ไม่ใช่ Super Admin</h3><p>สิทธิ์จัดการ Whitelist สงวนไว้เฉพาะ Super Admin เท่านั้น</p></div></article>
        </div>
      </section>

      <section id="plans-contact" className="plans-contact" aria-labelledby="plans-contact-title">
        <div className="plans-contact__copy">
          <span>พร้อมใช้งานต่อแล้วหรือยัง?</span>
          <h2 id="plans-contact-title">ติดต่อ Admin เพื่อขอสิทธิ์ VIP</h2>
          <p>แจ้งอีเมลที่ใช้เข้าสู่ระบบเพื่อให้ Admin ตรวจสอบและอนุมัติ Whitelist ได้รวดเร็วขึ้น</p>
          <div className="plans-contact__email"><small>อีเมลบัญชีของคุณ</small><strong>{authAccess?.email || 'ไม่พบอีเมล'}</strong></div>
        </div>
        <div className="plans-contact__methods">
          <AdminContactMethods userEmail={authAccess?.email} showLineQr />
        </div>
      </section>

      <footer className="plans-footer">
        <span>MatchFlow Studio · Football Broadcast Control</span>
        <button type="button" onClick={() => navigate('/')}>กลับไปใช้งาน Controller</button>
      </footer>
    </main>
  );
}

function FragmentRows({ group }: { group: (typeof ACCESS_PLAN_FEATURE_GROUPS)[number] }) {
  return (
    <>
      <tr className="plans-group-row">
        <th colSpan={3} scope="colgroup"><span aria-hidden="true">{group.icon}</span> {group.title}</th>
      </tr>
      {group.features.map((feature) => (
        <tr key={feature.label}>
          <th scope="row"><strong>{feature.label}</strong><span>{feature.description}</span></th>
          <td><AvailabilityMark available={feature.trialAvailable} /><span>{feature.trial}</span></td>
          <td><AvailabilityMark available={feature.vipAvailable} /><span>{feature.vip}</span></td>
        </tr>
      ))}
    </>
  );
}
