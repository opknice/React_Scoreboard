// OBS Setup Configuration
// This file contains the configuration for automatically setting up OBS scenes and sources

export interface SourceConfig {
  name: string;
  type: 'browser_source' | 'text_gdiplus_v3' | 'image_source' | 'color_source_v3';
  settings: Record<string, any>;
  transform?: {
    position: { x: number; y: number };
    scale: { x: number; y: number };
    rotation?: number;
    alignment?: number;
    boundsType?: number;
    boundsAlignment?: number;
    bounds?: { x: number; y: number };
  };
}

export interface SceneConfig {
  name: string;
  sources: SourceConfig[];
}

// Get the current origin for browser sources
const getOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5173';
};

// Browser Sources Configuration
export const BROWSER_SOURCES: SourceConfig[] = [
  {
    name: 'Penalty',
    type: 'browser_source',
    settings: {
      url: `${getOrigin()}/dots`,
      width: 1920,
      height: 1080,
      fps: 30,
      shutdown: true,
      restart_when_active: false,
      css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'
    },
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'Main_events',
    type: 'browser_source',
    settings: {
      url: `${getOrigin()}/overlay?view=ticker`,
      width: 1920,
      height: 200,
      fps: 30,
      shutdown: true,
      restart_when_active: false,
      css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'
    },
    transform: {
      position: { x: 0, y: 880 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'Standings',
    type: 'browser_source',
    settings: {
      url: `${getOrigin()}/overlay?view=table`,
      width: 1920,
      height: 1080,
      fps: 30,
      shutdown: true,
      restart_when_active: false,
      css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'
    },
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'Goal_Alert',
    type: 'browser_source',
    settings: {
      url: `${getOrigin()}/overlay?view=stadium`,
      width: 1920,
      height: 1080,
      fps: 30,
      shutdown: true,
      restart_when_active: false,
      css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'
    },
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  }
];

// Text Sources Configuration
export const TEXT_SOURCES: SourceConfig[] = [
  {
    name: 'score_team_a',
    type: 'text_gdiplus_v3',
    settings: {
      text: '0',
      font: {
        face: 'Arial',
        size: 72,
        style: 'Bold',
        flags: 0
      },
      color: 0xFFFFFFFF, // White
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 4,
      outline_color: 0xFF000000 // Black
    },
    transform: {
      position: { x: 800, y: 50 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'score_team_b',
    type: 'text_gdiplus_v3',
    settings: {
      text: '0',
      font: {
        face: 'Arial',
        size: 72,
        style: 'Bold',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 4,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 1100, y: 50 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'name_team_a',
    type: 'text_gdiplus_v3',
    settings: {
      text: 'Team A',
      font: {
        face: 'Arial',
        size: 48,
        style: 'Bold',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 3,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 400, y: 50 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'name_team_b',
    type: 'text_gdiplus_v3',
    settings: {
      text: 'Team B',
      font: {
        face: 'Arial',
        size: 48,
        style: 'Bold',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 3,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 1500, y: 50 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'time_counter',
    type: 'text_gdiplus_v3',
    settings: {
      text: '00:00',
      font: {
        face: 'Arial',
        size: 64,
        style: 'Bold',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 4,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 960, y: 150 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'half_text',
    type: 'text_gdiplus_v3',
    settings: {
      text: '1st Half',
      font: {
        face: 'Arial',
        size: 36,
        style: 'Regular',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'center',
      valign: 'center',
      outline: true,
      outline_size: 2,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 960, y: 220 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 5
    }
  },
  {
    name: 'label_1',
    type: 'text_gdiplus_v3',
    settings: {
      text: 'Label 1',
      font: {
        face: 'Arial',
        size: 32,
        style: 'Regular',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'left',
      valign: 'top',
      outline: true,
      outline_size: 2,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 50, y: 900 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 0
    }
  },
  {
    name: 'label_2',
    type: 'text_gdiplus_v3',
    settings: {
      text: 'Label 2',
      font: {
        face: 'Arial',
        size: 32,
        style: 'Regular',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'left',
      valign: 'top',
      outline: true,
      outline_size: 2,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 50, y: 950 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 0
    }
  },
  {
    name: 'label_3',
    type: 'text_gdiplus_v3',
    settings: {
      text: 'Label 3',
      font: {
        face: 'Arial',
        size: 32,
        style: 'Regular',
        flags: 0
      },
      color: 0xFFFFFFFF,
      align: 'left',
      valign: 'top',
      outline: true,
      outline_size: 2,
      outline_color: 0xFF000000
    },
    transform: {
      position: { x: 50, y: 1000 },
      scale: { x: 1.0, y: 1.0 },
      alignment: 0
    }
  }
];

// Image Sources Configuration
export const IMAGE_SOURCES: SourceConfig[] = [
  {
    name: 'logo_team_a',
    type: 'image_source',
    settings: {
      file: '', // Will be set dynamically
      unload: false
    },
    transform: {
      position: { x: 200, y: 50 },
      scale: { x: 0.2, y: 0.2 },
      alignment: 5
    }
  },
  {
    name: 'logo_team_b',
    type: 'image_source',
    settings: {
      file: '', // Will be set dynamically
      unload: false
    },
    transform: {
      position: { x: 1700, y: 50 },
      scale: { x: 0.2, y: 0.2 },
      alignment: 5
    }
  }
];

// Color Sources Configuration
export const COLOR_SOURCES: SourceConfig[] = [
  {
    name: 'Color_Team_A',
    type: 'color_source_v3',
    settings: {
      color: 0xFFFFFFFF, // White - will be set dynamically
      width: 1920,
      height: 1080
    },
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 0.1, y: 0.05 },
      alignment: 0
    }
  },
  {
    name: 'Color_Team_A_2',
    type: 'color_source_v3',
    settings: {
      color: 0xFF000000, // Black - will be set dynamically
      width: 1920,
      height: 1080
    },
    transform: {
      position: { x: 0, y: 60 },
      scale: { x: 0.1, y: 0.05 },
      alignment: 0
    }
  },
  {
    name: 'Color_Team_B',
    type: 'color_source_v3',
    settings: {
      color: 0xFFFFFFFF, // White - will be set dynamically
      width: 1920,
      height: 1080
    },
    transform: {
      position: { x: 1720, y: 0 },
      scale: { x: 0.1, y: 0.05 },
      alignment: 0
    }
  },
  {
    name: 'Color_Team_B_2',
    type: 'color_source_v3',
    settings: {
      color: 0xFF000000, // Black - will be set dynamically
      width: 1920,
      height: 1080
    },
    transform: {
      position: { x: 1720, y: 60 },
      scale: { x: 0.1, y: 0.05 },
      alignment: 0
    }
  }
];

// Main Scene Configuration
export const MAIN_SCENE_CONFIG: SceneConfig = {
  name: 'Main Stream',
  sources: [
    ...BROWSER_SOURCES,
    ...TEXT_SOURCES,
    ...IMAGE_SOURCES,
    ...COLOR_SOURCES
  ]
};

// Default visibility state for sources
export const DEFAULT_VISIBILITY: Record<string, boolean> = {
  'Penalty': false,
  'Main_events': true,
  'Standings': false,
  'Goal_Alert': false,
  'score_team_a': true,
  'score_team_b': true,
  'name_team_a': true,
  'name_team_b': true,
  'time_counter': true,
  'half_text': true,
  'label_1': true,
  'label_2': true,
  'label_3': true,
  'logo_team_a': true,
  'logo_team_b': true,
  'Color_Team_A': true,
  'Color_Team_A_2': true,
  'Color_Team_B': true,
  'Color_Team_B_2': true
};
