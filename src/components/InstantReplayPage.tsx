import { lazy, Suspense } from 'react';
const InstantReplayControl = lazy(() => import('./InstantReplayControl'));
const InstantReplayScreen = lazy(() => import('./InstantReplayScreen'));

interface InstantReplayPageProps {
  mode?: 'control' | 'screen';
}

/**
 * InstantReplayPage Component
 * 
 * Wrapper component that renders either the Control Panel (/replay) 
 * or the Screen Mode (/replay/screen) based on the mode prop.
 * 
 * Validates: Requirements 11.1, 11.2, 11.5, 11.6, 11.7
 */
export default function InstantReplayPage({ mode = 'control' }: InstantReplayPageProps) {
  if (mode === 'screen') {
    return <Suspense fallback={null}><InstantReplayScreen /></Suspense>;
  }

  return <Suspense fallback={<div role="status">กำลังโหลด Replay...</div>}><InstantReplayControl /></Suspense>;
}
