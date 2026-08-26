import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import type { FirebaseSaveTarget } from '../utils/excelParser';
import { listenToFirebaseTeams } from '../utils/logoResolver';

interface UseScoreboardFirebaseOptions {
  targets: FirebaseSaveTarget[];
  selectedTargetId: string;
  onTeamsUpdated: () => void;
}

/** Owns the Firebase app registry and the active teams subscription for the controller. */
export function useScoreboardFirebase({
  targets,
  selectedTargetId,
  onTeamsUpdated,
}: UseScoreboardFirebaseOptions) {
  const firebaseAppsRef = useRef<Record<string, FirebaseApp>>({});
  const onTeamsUpdatedRef = useRef(onTeamsUpdated);
  onTeamsUpdatedRef.current = onTeamsUpdated;

  const getOrCreateFirebaseApp = useCallback((target: FirebaseSaveTarget) => {
    const appName = `ExcelLeague_${target.id.replace(/[^A-Za-z0-9_]/g, '_')}_${target.index}`;
    const cachedApp = firebaseAppsRef.current[appName];
    if (cachedApp) return cachedApp;

    if (getApps().some((app) => app.name === appName)) {
      const existingApp = getApp(appName);
      firebaseAppsRef.current[appName] = existingApp;
      return existingApp;
    }

    const app = initializeApp(target.firebaseConfig, appName);
    firebaseAppsRef.current[appName] = app;
    return app;
  }, []);

  const activeFirebaseTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) || targets[0],
    [selectedTargetId, targets],
  );

  const activeDb = useMemo<Database | null>(
    () => {
      if (!activeFirebaseTarget) return null;
      try {
        return getDatabase(getOrCreateFirebaseApp(activeFirebaseTarget));
      } catch (error) {
        console.error('[Firebase] Failed to initialize active database:', error);
        return null;
      }
    },
    [activeFirebaseTarget, getOrCreateFirebaseApp],
  );

  useEffect(() => {
    if (!activeDb) return undefined;

    const unsubscribe = listenToFirebaseTeams(activeDb, () => {
      onTeamsUpdatedRef.current();
    });
    return () => unsubscribe();
  }, [activeDb]);

  return {
    activeFirebaseTarget,
    activeDb,
    getOrCreateFirebaseApp,
  };
}
