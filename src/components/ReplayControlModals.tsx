import { lazy, Suspense } from 'react';

const VarReplayPage = lazy(() => import('./VarReplayPage'));
const InstantReplayControl = lazy(() => import('./InstantReplayControl'));

interface ReplayControlModalsProps {
  showVarReplay: boolean;
  showInstantReplay: boolean;
  onCloseVarReplay: () => void;
  onCloseInstantReplay: () => void;
}

export default function ReplayControlModals({ showVarReplay, showInstantReplay, onCloseVarReplay, onCloseInstantReplay }: ReplayControlModalsProps) {
  return (
    <Suspense fallback={<div className="modal-overlay"><div className="modal-content">กำลังโหลด Replay...</div></div>}>
      {showVarReplay && <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onCloseVarReplay(); }}><div className="modal-content replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseVarReplay} title="ปิด">×</button><VarReplayPage mode="control" /></div></div>}
      {showInstantReplay && <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onCloseInstantReplay(); }}><div className="modal-content replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseInstantReplay} title="ปิด">×</button><InstantReplayControl /></div></div>}
    </Suspense>
  );
}
