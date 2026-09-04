import { useCustomMacros } from './useCustomMacros';
import type { OBSWebSocketApi } from './useOBSWebSocket';

export function useAutoMacros(obs: Pick<OBSWebSocketApi, 'getObsRef' | 'isConnected'>) {
  return useCustomMacros(obs);
}
