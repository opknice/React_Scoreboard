export type MacroEvent =
  | 'ReplayBufferSaved'
  | 'ReplayVideoEnded'
  | 'ButtonClicked'
  | 'KeyPressed'
  | 'CustomEvent'
  | 'StreamStateChanged'
  | 'RecordStateChanged'
  | 'ReplayBufferStateChanged'
  | 'MediaInputPlaybackStarted'
  | 'MediaInputPlaybackEnded'
  | 'CurrentProgramSceneChanged';

export type MacroFilterKind = 'any' | 'button' | 'key' | 'hotkey' | 'scene' | 'input';

export interface MacroFilter {
  kind: MacroFilterKind;
  value?: string;
  modifiers?: string[];
  keyField?: 'key' | 'code';
}

export type ActionType = 'switchScene' | 'showSource' | 'hideSource' | 'wait' | 'openVarReplay' | 'closeVarReplay' | 'openReplayControl' | 'closeReplayControl' | 'saveReplayBuffer' | 'loadLatestReplay';

export interface ActionStep {
  id: string;
  type: ActionType;
  // switchScene
  sceneName?: string;
  // showSource / hideSource
  sourceScene?: string;
  sourceName?: string;
  // wait
  delayMs?: number;
}

export interface CustomMacro {
  id: string;
  name: string;
  color: string;
  isEnabled: boolean;
  trigger: {
    event: MacroEvent;
    filter?: MacroFilter;
    // Legacy fields are retained so existing localStorage data can be read.
    // New UI writes the semantic `filter` object above.
    filterKey?: string;
    filterValue?: string;
    filterModifiers?: string; // For keyboard shortcuts: 'ctrl,shift,alt,meta'
  };
  actions: ActionStep[];
  logs: string[];
  lastTrigger: string;
}

export type MacroRuntimeStatus = 'idle' | 'running' | 'success' | 'error' | 'offline';
