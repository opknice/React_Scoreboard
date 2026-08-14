export const VAR_REPLAY_V2_CHANNEL = 'scoreboard_var_replay_studio_v3';

export type VarReplayV2Transform = {
  zoom: number;
  x: number;
  y: number;
};

export type VarReplayV2State = {
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
  speed: number;
  isPlaying: boolean;
  loopEnabled: boolean;
  transform: VarReplayV2Transform;
};

export type VarReplayV2Message =
  | { type: 'file'; data: ArrayBuffer; mime: string; name: string; state?: VarReplayV2State }
  | { type: 'request-sync' }
  | { type: 'command'; action: 'play' | 'pause' | 'seek' | 'set-marker' | 'clear-markers' | 'set-speed' | 'set-loop' | 'set-transform'; value?: number | VarReplayV2Transform; marker?: 'A' | 'B'; enabled?: boolean; smooth?: boolean }
  | {
      type: 'status';
      ready: boolean;
      duration: number;
      currentTime: number;
      markerA: number | null;
      markerB: number | null;
      isPlaying: boolean;
      loopEnabled: boolean;
    };
