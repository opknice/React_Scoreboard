import { lazy, Suspense } from 'react';

const VarReplayV2Page = lazy(() => import('./var-replay-v2/VarReplayV2Page'));
const InstantReplayControl = lazy(() => import('./InstantReplayControl'));

interface ReplayControlModalsProps {
  showVarReplayV2: boolean;
  showInstantReplay: boolean;
  onCloseVarReplayV2: () => void;
  onCloseInstantReplay: () => void;
}

export default function ReplayControlModals({
  showVarReplayV2,
  showInstantReplay,
  onCloseVarReplayV2,
  onCloseInstantReplay,
}: ReplayControlModalsProps) {
  return (
    <Suspense fallback={<div className="modal-overlay"><div className="modal-content">กำลังโหลด Replay...</div></div>}>
      {showVarReplayV2 && <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onCloseVarReplayV2(); }}><div className="modal-content replay-control-modal var-v2-replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseVarReplayV2} title="ปิด">×</button><VarReplayV2Page mode="control" onBack={onCloseVarReplayV2} /></div></div>}
      {showInstantReplay && <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onCloseInstantReplay(); }}><div className="modal-content replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseInstantReplay} title="ปิด">×</button><InstantReplayControl /></div></div>}
    </Suspense>
  );
}
