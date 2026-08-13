interface ScoreboardInfoModalsProps {
  trans: any;
  showHelp: boolean;
  showDonate: boolean;
  showChangelog: boolean;
  onCloseHelp: () => void;
  onCloseDonate: () => void;
  onCloseChangelog: () => void;
}

export default function ScoreboardInfoModals({
  trans,
  showHelp,
  showDonate,
  showChangelog,
  onCloseHelp,
  onCloseDonate,
  onCloseChangelog,
}: ScoreboardInfoModalsProps) {
  return (
    <>
      {showHelp && (
        <div className="modal-overlay" onClick={onCloseHelp}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3><i className="fas fa-question-circle"></i> {trans.helpTitle}</h3>
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep1 }} />
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep2 }} />
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep3 }} />
            <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-primary" onClick={onCloseHelp}>{trans.understand}</button></div>
          </div>
        </div>
      )}

      {showDonate && (
        <div className="modal-overlay" onClick={onCloseDonate}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3><i className="fas fa-hand-holding-usd"></i> {trans.donateTitle}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div>{trans.donateThai}</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://easydonate.app/Jamornz" alt="QR สำหรับสนับสนุนโครงการ" />
              <a href="https://easydonate.app/Jamornz" target="_blank" rel="noreferrer">https://easydonate.app/Jamornz</a>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onCloseDonate}>{trans.close}</button></div>
          </div>
        </div>
      )}

      {showChangelog && (
        <div className="modal-overlay" onClick={onCloseChangelog}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3><i className="fas fa-history"></i> {trans.changelogTitle || 'Changelog'}</h3>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: trans.changelogContent || '<p>No changelog available.</p>' }} />
            <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-primary" onClick={onCloseChangelog}>{trans.close}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
