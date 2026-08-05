export type ActionType = 'switchScene' | 'showSource' | 'hideSource' | 'wait';

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
    event: string;
    filterKey?: string;
    filterValue?: string;
  };
  actions: ActionStep[];
  logs: string[];
  lastTrigger: string;
}
