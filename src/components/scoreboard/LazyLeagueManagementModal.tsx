import { lazy, memo, Suspense } from 'react';
import type { LeagueManagementModalProps } from '../LeagueManagementModal';
import ScoreboardLazyFallback from './ScoreboardLazyFallback';

const loadLeagueManagementModal = () => import('../LeagueManagementModal');
const LeagueManagementModal = lazy(loadLeagueManagementModal);

function LazyLeagueManagementModal(props: LeagueManagementModalProps) {
  return (
    <Suspense fallback={<ScoreboardLazyFallback />}>
      <LeagueManagementModal {...props} />
    </Suspense>
  );
}

export default memo(LazyLeagueManagementModal);
