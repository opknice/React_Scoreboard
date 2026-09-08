import { lazy, memo, Suspense } from 'react';
import ModalBackdrop from './ModalBackdrop';
import ScoreboardLazyFallback from './scoreboard/ScoreboardLazyFallback';
import type { ReplayObsSetupProps } from '../types/replayObsSetup';

const VarReplayV2Page = lazy(() => import('./var-replay-v2/VarReplayV2Page'));
const InstantReplayControl = lazy(() => import('./InstantReplayControl'));

interface ReplayControlModalsProps {
  showVarReplayV2: boolean;
  showInstantReplay: boolean;
  onCloseVarReplayV2: () => void;
  onCloseInstantReplay: () => void;
  varObsSetup: ReplayObsSetupProps;
  instantReplayObsSetup: ReplayObsSetupProps;
}

function ReplayControlModals({
  showVarReplayV2,
  showInstantReplay,
  onCloseVarReplayV2,
  onCloseInstantReplay,
  varObsSetup,
  instantReplayObsSetup,
}: ReplayControlModalsProps) {
  return (
    <Suspense fallback={<ScoreboardLazyFallback onClose={() => {
      if (showVarReplayV2) onCloseVarReplayV2();
      if (showInstantReplay) onCloseInstantReplay();
    }} />}>
      {showVarReplayV2 && <ModalBackdrop className="modal-overlay" style={{ zIndex: 9999 }} onEscape={onCloseVarReplayV2}><div className="modal-content replay-control-modal var-v2-replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseVarReplayV2} title="ปิด">×</button><VarReplayV2Page mode="control" onBack={onCloseVarReplayV2} obsSetup={varObsSetup} /></div></ModalBackdrop>}
      {showInstantReplay && <ModalBackdrop className="modal-overlay" style={{ zIndex: 9999 }} onEscape={onCloseInstantReplay}><div className="modal-content replay-control-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="replay-modal-close" onClick={onCloseInstantReplay} title="ปิด">×</button><InstantReplayControl obsSetup={instantReplayObsSetup} /></div></ModalBackdrop>}
    </Suspense>
  );
}

export default memo(ReplayControlModals);
