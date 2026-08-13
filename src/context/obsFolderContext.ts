import { createContext } from 'react';
import type { ObsVideoFolderContextValue } from '../hooks/useObsVideoFolder';

export const ObsVideoFolderContext = createContext<ObsVideoFolderContextValue | null>(null);
