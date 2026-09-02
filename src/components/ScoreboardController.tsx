import React, { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDatabase, ref, push } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { onAuthStateChange, logoutUser, isSuperAdmin } from '../services/supabaseAuthService';
import { useTimer } from '../hooks/useTimer';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import { useAutoMacros } from '../hooks/useAutoMacros';
import { useScoreboardFirebase } from '../hooks/useScoreboardFirebase';
import { useScoreboardObsConnection } from '../hooks/useScoreboardObsConnection';
import {
  broadcastScoreboardButton,
  useModalControlChannel,
  useScoreboardKeyboardBroadcast,
  broadcastGoalScored,
  broadcastScoreboardState,
  useScoreboardStateResponder,
} from '../hooks/useScoreboardChannels';
import { useScoreboardObsSync } from '../hooks/useScoreboardObsSync';
import { useAutoObsSourceSync } from '../hooks/useAutoObsSourceSync';
import { useScoreboardDatabase } from '../hooks/useScoreboardDatabase';
import { translations } from '../constants/translations';
import type { FirebaseSaveTarget } from '../utils/firebaseUrlConfig';
import { getLogoSrc as resolveLogoSrc } from '../utils/logoResolver';
import ReplayControlModals from './ReplayControlModals';
import ScoreboardTimerPanel from './ScoreboardTimerPanel';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useObsReplayBufferFolderRescan } from '../hooks/useObsReplayBufferFolderRescan';
import { useScoreboardModalState } from '../hooks/useScoreboardModalState';
import { useScoreboardMatchState } from '../hooks/useScoreboardMatchState';
import { useAuthAccess } from '../hooks/useAuthAccess';
import { formatTrialRemaining } from '../utils/trialAccess';
import { getOrigin } from '../config/obsSetupConfig';
import {
  DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
  TEAM_NAME_SETTINGS_STORAGE_KEY,
  normalizeTeamNameBrowserSettings,
  type TeamNameBrowserSettings,
} from '../types/teamNameBrowserSettings';
import { buildTeamNameBrowserUrl } from '../utils/teamNameBrowserUrl';
import { OBSSetupService } from '../services/obsSetupService';
import {
  DEFAULT_SCORE_BROWSER_SETTINGS,
  SCORE_SETTINGS_STORAGE_KEY,
  normalizeScoreBrowserSettings,
  type ScoreBrowserSettings,
} from '../types/scoreBrowserSettings';
import { buildScoreBrowserUrl } from '../utils/scoreBrowserUrl';
import {
  DEFAULT_LOGO_BROWSER_SETTINGS,
  LOGO_SETTINGS_STORAGE_KEY,
  normalizeLogoBrowserSettings,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';
import { buildLogoBrowserUrl } from '../utils/logoBrowserUrl';

const AutoMacrosPanel = lazy(() => import('./AutoMacrosPanel'));
const LogoUploader = lazy(() => import('./LogoUploader'));
const TeamLogosManagerModal = lazy(() => import('./TeamLogosManagerModal'));
const DatabaseMatchesModal = lazy(() => import('./DatabaseMatchesModal'));
const EditDatabaseMatchModal = lazy(() => import('./EditDatabaseMatchModal'));
const ScoreboardInfoModals = lazy(() => import('./ScoreboardInfoModals'));
const QuickSetupModal = lazy(() => import('./QuickSetupModal'));
const ObsSetupModal = lazy(() => import('./ObsSetupModal'));
const PresetTimeModal = lazy(() => import('./PresetTimeModal'));
const TeamSelectModal = lazy(() => import('./TeamSelectModal'));
const PenaltyShootoutModal = lazy(() => import('./PenaltyShootoutModal'));
const ScoreboardSettingsModal = lazy(() => import('./ScoreboardSettingsModal'));
const LeagueManagementModal = lazy(() => import('./LeagueManagementModal'));
import { useSupabaseLeague } from '../hooks/useSupabaseLeague';
import type { Match as SupabaseMatch, Team as SupabaseTeam } from '../config/supabaseClient';
import type { SelectableTeam } from './TeamSelectModal';
import UserAvatar from './UserAvatar';

function renderTeamName(teamName: string) {
  return teamName.split('/').map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {index > 0 && <br />}
      {part}
    </React.Fragment>
  ));
}

export default function ScoreboardController() {
  const navigate = useNavigate();
  const authAccess = useAuthAccess();
  const [, setTrialClock] = useState(Date.now());
  const timerHook = useTimer();
  // Stable ref so the OBS WebSocket event listener always calls the latest handleHotkeyAction
  // without being re-registered every render (avoids stale closure on hotkeys)
  const hotkeyHandlerRef = useRef<((action: string) => void) | null>(null);

  const videoFolder = useObsVideoFolderContext();
  const handleObsReplayBufferSaved = useObsReplayBufferFolderRescan(videoFolder.rescan);

  const obs = useOBSWebSocket(
    useCallback((action: string) => {
      hotkeyHandlerRef.current?.(action);
    }, []),
    handleObsReplayBufferSaved
  );

  // Auto Macros Hook (runs in background always)
  const autoMacros = useAutoMacros(obs);

  // --- Local States ---
  const [currentLang] = useState<string>(() => localStorage.getItem('scoreboardLang') || 'th');
  const [logoFolderPath, setLogoFolderPath] = useState<string>(() => localStorage.getItem('logoFolderPath') || 'D:\\OBS_football\\logos');
  const [matchIdInput, setMatchIdInput] = useState<number>(1);
  const [firebaseTargets] = useState<FirebaseSaveTarget[]>([]);
  const [teamColorsMemory, setTeamColorsMemory] = useState<Record<string, { color1: string; color2: string }>>(() => {
    const saved = localStorage.getItem('teamColors');
    return saved ? JSON.parse(saved) : {};
  });
  const [teamLogosMemory, setTeamLogosMemory] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('teamLogos');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (authAccess?.accessType !== 'trial') return undefined;
    const intervalId = window.setInterval(() => setTrialClock(Date.now()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [authAccess?.accessType]);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChange((event, session) => {
        if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') {
          return;
        }
        setCurrentUser(session?.user ?? null);
      });
      return () => unsubscribe();
    } catch {
      // ignore if auth not initialized
    }
  }, []);

  const saveTeamLogo = (teamName: string, url: string) => {
    if (!teamName || !url) return;
    const cleanKey = teamName.trim().toLowerCase();
    setTeamLogosMemory((prev) => {
      const updated = { ...prev, [cleanKey]: url };
      localStorage.setItem('teamLogos', JSON.stringify(updated));
      return updated;
    });
  };

  const getTeamLogo = useCallback((teamName: string) => {
    if (!teamName) return '';
    const cleanKey = teamName.trim().toLowerCase();
    return teamLogosMemory[cleanKey] || '';
  }, [teamLogosMemory]);

  const {
    nameA, setNameA,
    nameB, setNameB,
    scoreA, setScoreA,
    scoreB, setScoreB,
    colorA1, setColorA1,
    colorA2, setColorA2,
    colorB1, setColorB1,
    colorB2, setColorB2,
    logoA, setLogoA,
    logoB, setLogoB,
    label1, setLabel1,
    label2, setLabel2,
    label3, setLabel3,
    isEditingA, setIsEditingA,
    isEditingB, setIsEditingB,
    editNameAVal, setEditNameAVal,
    editNameBVal, setEditNameBVal,
  } = useScoreboardMatchState();

  // Sync team names to localStorage for Penalty Shootout
  useEffect(() => {
    localStorage.setItem('penalty_teamA', nameA);
    localStorage.setItem('penalty_teamB', nameB);
  }, [nameA, nameB]);
  // Modals Visibility
  const {
    showSettingsModal, setShowSettingsModal,
    showDatabaseModal, setShowDatabaseModal,
    showHelpModal, setShowHelpModal,
    showPenaltyModal, setShowPenaltyModal,
    showVarReplayV2Modal, setShowVarReplayV2Modal,
    showInstantReplayModal, setShowInstantReplayModal,
    showDonateModal, setShowDonateModal,
    showLogoPathModal, setShowLogoPathModal,
    showPresetTimeModal, setShowPresetTimeModal,
    showQuickSetupModal, setShowQuickSetupModal,
    showChangelogModal, setShowChangelogModal,
    showTeamSelectModal, setShowTeamSelectModal,
    showAutoMacrosModal, setShowAutoMacrosModal,
    showTeamLogosManagerModal, setShowTeamLogosManagerModal,
    showOBSSetupModal, setShowOBSSetupModal,
  } = useScoreboardModalState();
  const [teamsCacheVersion, setTeamsCacheVersion] = useState<number>(0);
  const [tickerSpeed, setTickerSpeed] = useState<number>(() => parseInt(localStorage.getItem('tickerSpeed') || '75', 10));
  const [teamNameSettings, setTeamNameSettings] = useState<TeamNameBrowserSettings>(() => {
    try {
      const saved = localStorage.getItem(TEAM_NAME_SETTINGS_STORAGE_KEY);
      return saved ? normalizeTeamNameBrowserSettings(JSON.parse(saved)) : DEFAULT_TEAM_NAME_BROWSER_SETTINGS;
    } catch {
      return DEFAULT_TEAM_NAME_BROWSER_SETTINGS;
    }
  });
  const [teamNameObsBusy, setTeamNameObsBusy] = useState(false);
  const [teamNameObsMessage, setTeamNameObsMessage] = useState('');
  const [logoSettings, setLogoSettings] = useState<LogoBrowserSettings>(() => {
    try {
      const saved = localStorage.getItem(LOGO_SETTINGS_STORAGE_KEY);
      return saved ? normalizeLogoBrowserSettings(JSON.parse(saved)) : DEFAULT_LOGO_BROWSER_SETTINGS;
    } catch {
      return DEFAULT_LOGO_BROWSER_SETTINGS;
    }
  });
  const [logoObsBusy, setLogoObsBusy] = useState(false);
  const [logoObsMessage, setLogoObsMessage] = useState('');
  const [scoreSettings, setScoreSettings] = useState<ScoreBrowserSettings>(() => {
    try {
      const saved = localStorage.getItem(SCORE_SETTINGS_STORAGE_KEY);
      return saved ? normalizeScoreBrowserSettings(JSON.parse(saved)) : DEFAULT_SCORE_BROWSER_SETTINGS;
    } catch {
      return DEFAULT_SCORE_BROWSER_SETTINGS;
    }
  });
  const [scoreObsBusy, setScoreObsBusy] = useState(false);
  const [scoreObsMessage, setScoreObsMessage] = useState('');
  const [teamSelectTarget, setTeamSelectTarget] = useState<'A' | 'B'>('A');
  const [teamSelectSearch, setTeamSelectSearch] = useState<string>('');
  const [showLeagueManagementModal, setShowLeagueManagementModal] = useState<boolean>(false);
  const [leagueModalInitialTab, setLeagueModalInitialTab] = useState<'league' | 'teams' | 'matches'>('matches');
  const [isMatchLoaded, setIsMatchLoaded] = useState<boolean>(() => localStorage.getItem('isMatchLoaded') === 'true');

  // Custom Preset Time Input
  const [customTimeMinutes, setCustomTimeMinutes] = useState<number>(0);
  const [customTimeSeconds, setCustomTimeSeconds] = useState<number>(0);

  // Announcement details text
  const [detailsTemplate, setDetailsTemplate] = useState<string>(() => localStorage.getItem('detailsText') || '');

  // Database Viewer States
  const [selectedQuickLeagueId, setSelectedQuickLeagueId] = useState<string>('');

  // Toast States
  const [toasts, setToasts] = useState<{ id: string; message: string; type: string }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(TEAM_NAME_SETTINGS_STORAGE_KEY, JSON.stringify(teamNameSettings));
    } catch {
      console.warn('[Scoreboard] Unable to persist Team Name settings (storage may be full)');
    }
  }, [teamNameSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(SCORE_SETTINGS_STORAGE_KEY, JSON.stringify(scoreSettings));
    } catch {
      console.warn('[Scoreboard] Unable to persist Score settings (storage may be full)');
    }
  }, [scoreSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOGO_SETTINGS_STORAGE_KEY, JSON.stringify(logoSettings));
    } catch {
      console.warn('[Scoreboard] Unable to persist Logo settings (storage may be full)');
    }
  }, [logoSettings]);

  const trans = translations[currentLang] || translations.en;

  const { activeDb, getOrCreateFirebaseApp } = useScoreboardFirebase({
    targets: firebaseTargets,
    selectedTargetId: selectedQuickLeagueId,
    onTeamsUpdated: () => setTeamsCacheVersion((previous) => previous + 1),
  });

  // --- Toast Function ---
  const triggerToast = useCallback((message: string, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const teamNameUrls = useMemo(() => ({
    A: buildTeamNameBrowserUrl(getOrigin(), 'A', teamNameSettings),
    B: buildTeamNameBrowserUrl(getOrigin(), 'B', teamNameSettings),
  }), [teamNameSettings]);

  const copyTeamNameUrl = useCallback(async (side: 'A' | 'B') => {
    try {
      await navigator.clipboard.writeText(teamNameUrls[side]);
      triggerToast(`คัดลอก URL Team ${side} แล้ว`, 'success');
    } catch {
      triggerToast('ไม่สามารถคัดลอก URL ได้', 'error');
    }
  }, [teamNameUrls, triggerToast]);

  const scoreUrls = useMemo(() => ({
    A: buildScoreBrowserUrl(getOrigin(), 'A', scoreSettings),
    B: buildScoreBrowserUrl(getOrigin(), 'B', scoreSettings),
    both: buildScoreBrowserUrl(getOrigin(), 'both', scoreSettings),
  }), [scoreSettings]);

  const logoUrls = useMemo(() => ({
    A: buildLogoBrowserUrl(getOrigin(), 'A', logoSettings),
    B: buildLogoBrowserUrl(getOrigin(), 'B', logoSettings),
  }), [logoSettings]);

  const updateLogoSettings = useCallback((patch: Partial<LogoBrowserSettings>) => {
    setLogoSettings((current) => normalizeLogoBrowserSettings({ ...current, ...patch }));
  }, []);

  const updateScoreSettings = useCallback((patch: Partial<ScoreBrowserSettings>) => {
    setScoreSettings((current) => normalizeScoreBrowserSettings({ ...current, ...patch }));
  }, []);

  const copyScoreUrl = useCallback(async (side: 'A' | 'B' | 'both') => {
    try {
      await navigator.clipboard.writeText(scoreUrls[side]);
      triggerToast(`คัดลอก URL Score ${side} แล้ว`, 'success');
    } catch {
      triggerToast('ไม่สามารถคัดลอก URL Score ได้', 'error');
    }
  }, [scoreUrls, triggerToast]);

  const updateTeamNameSettings = useCallback((patch: Partial<TeamNameBrowserSettings>) => {
    setTeamNameSettings((current) => normalizeTeamNameBrowserSettings({ ...current, ...patch }));
  }, []);

  const runTeamNameObsAction = useCallback(async (action: 'add' | 'update') => {
    const obsRef = obs.getObsRef();
    if (!obs.isConnected || !obsRef) {
      triggerToast('กรุณาเชื่อมต่อ OBS WebSocket ก่อน', 'error');
      return;
    }

    setTeamNameObsBusy(true);
    setTeamNameObsMessage('กำลังดำเนินการ...');
    try {
      const service = new OBSSetupService(obsRef);
      const result = action === 'add'
        ? await service.addOrUpdateTeamNameBrowserSources(teamNameSettings)
        : await service.updateTeamNameBrowserSources(teamNameSettings);
      setTeamNameObsMessage(result.message);
      triggerToast(result.message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถตั้งค่า OBS ได้';
      setTeamNameObsMessage(message);
      triggerToast(message, 'error');
    } finally {
      setTeamNameObsBusy(false);
    }
  }, [obs, teamNameSettings, triggerToast]);

  const runScoreObsAction = useCallback(async (action: 'add' | 'update') => {
    const obsRef = obs.getObsRef();
    if (!obs.isConnected || !obsRef) {
      triggerToast('กรุณาเชื่อมต่อ OBS WebSocket ก่อน', 'error');
      return;
    }

    setScoreObsBusy(true);
    setScoreObsMessage('กำลังดำเนินการ...');
    try {
      const service = new OBSSetupService(obsRef);
      const result = action === 'add'
        ? await service.addOrUpdateScoreBrowserSources(scoreSettings)
        : await service.updateScoreBrowserSources(scoreSettings);
      setScoreObsMessage(result.message);
      triggerToast(result.message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถตั้งค่า Score ใน OBS ได้';
      setScoreObsMessage(message);
      triggerToast(message, 'error');
    } finally {
      setScoreObsBusy(false);
    }
  }, [obs, scoreSettings, triggerToast]);

  const copyLogoUrl = useCallback(async (side: 'A' | 'B') => {
    try {
      await navigator.clipboard.writeText(logoUrls[side]);
      triggerToast(`คัดลอก URL Logo ${side} แล้ว`, 'success');
    } catch {
      triggerToast('ไม่สามารถคัดลอก URL Logo ได้', 'error');
    }
  }, [logoUrls, triggerToast]);

  const runLogoObsAction = useCallback(async (action: 'add' | 'update') => {
    const obsRef = obs.getObsRef();
    if (!obs.isConnected || !obsRef) {
      triggerToast('กรุณาเชื่อมต่อ OBS WebSocket ก่อน', 'error');
      return;
    }

    setLogoObsBusy(true);
    setLogoObsMessage('กำลังดำเนินการ...');
    try {
      const service = new OBSSetupService(obsRef);
      const result = action === 'add'
        ? await service.addOrUpdateLogoBrowserSources(logoSettings)
        : await service.updateLogoBrowserSources(logoSettings);
      setLogoObsMessage(result.message);
      triggerToast(result.message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถตั้งค่า Logo ใน OBS ได้';
      setLogoObsMessage(message);
      triggerToast(message, 'error');
    } finally {
      setLogoObsBusy(false);
    }
  }, [obs, logoSettings, triggerToast]);

  const database = useScoreboardDatabase({
    activeDb,
    targets: firebaseTargets,
    selectedTargetId: selectedQuickLeagueId,
    notify: triggerToast,
  });

  const activeUserEmail = currentUser?.email || authAccess?.email || '';
  const supabaseLeague = useSupabaseLeague(triggerToast, activeUserEmail);
  const [selectedLeagueIdToLoad, setSelectedLeagueIdToLoad] = useState<string>(() => supabaseLeague.activeLeagueId || '');

  useEffect(() => {
    if (supabaseLeague.activeLeagueId) {
      setSelectedLeagueIdToLoad(supabaseLeague.activeLeagueId);
    }
  }, [supabaseLeague.activeLeagueId]);

  // Compute list of unique team names from Supabase teams
  const allUniqueTeams = useMemo(() => {
    return supabaseLeague.teams.map((t) => t.name).filter(Boolean);
  }, [supabaseLeague.teams]);

  // --- 2-Step Setup Onboarding Gate Checks ---
  const isStep1Complete = videoFolder.isConnected;
  const isStep2Complete =
    isMatchLoaded ||
    Boolean(supabaseLeague.activeLeagueId) ||
    supabaseLeague.matches.length > 0;
  const isSetupComplete = isStep1Complete && isStep2Complete;

  // --- Prevent spacebar default behavior (except inside inputs/textareas) ---
  useEffect(() => {
    const preventSpacebar = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      if (!isInput && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', preventSpacebar);

    return () => {
      window.removeEventListener('keydown', preventSpacebar);
    };
  }, []);

  useScoreboardKeyboardBroadcast();
  useModalControlChannel({
    // Keep the existing modal-control protocol so saved Macros continue to work,
    // while routing VAR commands to the V2 controller.
    onVarReplay: setShowVarReplayV2Modal,
    onReplay: setShowInstantReplayModal,
  });

  useScoreboardObsConnection({
    obs,
    onConnected: () => triggerToast(trans.toastObsSuccess, 'success'),
    onError: () => triggerToast(trans.toastObsError, 'error'),
  });

  useScoreboardObsSync({
    obs,
    scoreA,
    scoreB,
    formattedTime: timerHook.formattedTime,
    half: timerHook.half,
  });

  useAutoObsSourceSync({
    obs,
    teamNameSettings,
    logoSettings,
    scoreSettings,
  });

  // Keep the persistent score Browser Source synchronized, including after
  // it is opened or refreshed after the last goal event was sent.
  useEffect(() => {
    broadcastScoreboardState({
      scoreA,
      scoreB,
      nameA,
      nameB,
      logoA: resolveLogoSrc(logoA, nameA, logoFolderPath),
      logoB: resolveLogoSrc(logoB, nameB, logoFolderPath),
      colorA1,
      colorA2,
      colorB1,
      colorB2,
    });
  }, [colorA1, colorA2, colorB1, colorB2, logoA, logoB, logoFolderPath, nameA, nameB, scoreA, scoreB, teamsCacheVersion]);

  useScoreboardStateResponder({
    scoreA,
    scoreB,
    nameA,
    nameB,
    logoA: resolveLogoSrc(logoA, nameA, logoFolderPath),
    logoB: resolveLogoSrc(logoB, nameB, logoFolderPath),
    colorA1,
    colorA2,
    colorB1,
    colorB2,
  });

  const addGoal = (team: 'A' | 'B', source: 'manual' | 'hotkey' | 'macro') => {
    const nextScoreA = team === 'A' ? scoreA + 1 : scoreA;
    const nextScoreB = team === 'B' ? scoreB + 1 : scoreB;
    const teamName = team === 'A' ? nameA : nameB;
    const logo = team === 'A' ? logoA : logoB;
    const color1 = team === 'A' ? colorA1 : colorB1;
    const color2 = team === 'A' ? colorA2 : colorB2;

    if (team === 'A') {
      setScoreA(nextScoreA);
    } else {
      setScoreB(nextScoreB);
    }

    broadcastScoreboardButton(`goal_${team}`);
    broadcastGoalScored({
      team,
      teamName,
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      logo: getLogoSrc(logo, teamName),
      color1,
      color2,
      source,
    });
  };

  // --- Hotkey Callback Handler ---
  const handleHotkeyAction = (action: string) => {
    switch (action) {
      case 'play1':
        timerHook.start1();
        break;
      case 'halfpause':
        timerHook.halfpause();
        break;
      case 'play2':
        timerHook.start2();
        break;
      case 'fullend':
        timerHook.fulltime();
        break;
      case 'swap':
        swapTeams();
        break;
      case 'scoreAplus':
        addGoal('A', 'hotkey');
        break;
      case 'scoreAminus':
        setScoreA((prev) => Math.max(0, prev - 1));
        break;
      case 'scoreBplus':
        addGoal('B', 'hotkey');
        break;
      case 'scoreBminus':
        setScoreB((prev) => Math.max(0, prev - 1));
        break;
      case 'hidetimer':
        timerHook.pause();
        obs.setText('time_counter', '');
        obs.setText('half_text', '');
        break;
      default:
        break;
    }
  };
  // Sync ref every render so the stable OBS callback always has the latest handler
  hotkeyHandlerRef.current = handleHotkeyAction;

  // --- Get Initials ---
  const getTeamInitials = (nameStr: string) => {
    if (!nameStr) return '';
    const parts = nameStr.split(' ').filter(Boolean);
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : nameStr.substring(0, 2)).toUpperCase();
  };

  // --- Team Color Storage Helpers ---
  const saveTeamColors = (teamName: string, colors: { color1: string; color2: string }) => {
    if (!teamName) return;
    const encoded = encodeURIComponent(teamName);
    const updated = { ...teamColorsMemory, [encoded]: colors };
    setTeamColorsMemory(updated);
    localStorage.setItem('teamColors', JSON.stringify(updated));
  };

  const getTeamColors = useCallback((teamName: string) => {
    if (!teamName) return { color1: '#ffffff', color2: '#ffffff' };
    const encoded = encodeURIComponent(teamName);
    return teamColorsMemory[encoded] || { color1: '#ffffff', color2: '#ffffff' };
  }, [teamColorsMemory]);

  // --- Apply team from Supabase selection ---
  const applyTeamFromSupabase = (team: SelectableTeam, target: 'A' | 'B') => {
    const primaryColor = team.color_primary || '#ffffff';
    const secondaryColor = team.color_secondary || '#000000';
    const logoSrc = team.logo_url || getTeamLogo(team.name) || team.name;

    if (target === 'A') {
      setNameA(team.name);
      setColorA1(primaryColor);
      setColorA2(secondaryColor);
      setLogoA(logoSrc);
      obs.setText('name_team_a', team.name.replace(/\//g, '\n'));
      obs.setImage('logo_team_a', logoSrc, logoFolderPath);
      obs.setSourceColor('Color_Team_A', primaryColor);
      obs.setSourceColor('Color_Team_A_2', secondaryColor);
    } else {
      setNameB(team.name);
      setColorB1(primaryColor);
      setColorB2(secondaryColor);
      setLogoB(logoSrc);
      obs.setText('name_team_b', team.name.replace(/\//g, '\n'));
      obs.setImage('logo_team_b', logoSrc, logoFolderPath);
      obs.setSourceColor('Color_Team_B', primaryColor);
      obs.setSourceColor('Color_Team_B_2', secondaryColor);
    }
    setShowTeamSelectModal(false);
    setTeamSelectSearch('');
    triggerToast(`เลือกทีม ${team.name} แล้ว`, 'success');
  };

  // --- Logo Preview Logic ---
  const getLogoSrc = useCallback((logoName: string, teamName?: string) => {
    const rawLogo = (logoName || '').trim();
    if (rawLogo.startsWith('http://') || rawLogo.startsWith('https://')) {
      return rawLogo;
    }
    const cleanTeam = (teamName || '').trim().toLowerCase();
    const foundTeam = supabaseLeague.teams.find(
      (t) =>
        (cleanTeam && t.name.toLowerCase() === cleanTeam) ||
        (rawLogo && t.name.toLowerCase() === rawLogo.toLowerCase()) ||
        t.id === rawLogo
    );
    if (foundTeam?.logo_url) {
      return foundTeam.logo_url;
    }
    return resolveLogoSrc(logoName, teamName, logoFolderPath);
  }, [supabaseLeague.teams, logoFolderPath]);

  // --- Helper: Check if match is finished / has recorded results ---
  const isMatchFinished = useCallback((m: SupabaseMatch) => {
    return m.status === 'finished' || (typeof m.score_a === 'number' && typeof m.score_b === 'number' && (m.score_a > 0 || m.score_b > 0));
  }, []);

  // --- Pending (Unplayed) matches in active league ---
  const pendingMatches = useMemo(() => {
    return supabaseLeague.matches.filter((m) => !isMatchFinished(m));
  }, [supabaseLeague.matches, isMatchFinished]);

  // --- Load match data by ID from Supabase ---
  const applyMatch = (matchId = matchIdInput) => {
    if (supabaseLeague.matches.length > 0) {
      const sbMatch = supabaseLeague.matches.find((m) => m.match_number === matchId);
      if (sbMatch) {
        if (isMatchFinished(sbMatch)) {
          triggerToast(`⚠️ แมตช์ #${matchId} (${sbMatch.team_a_name} vs ${sbMatch.team_b_name}) มีการบันทึกผลแล้ว ไม่สามารถโหลดได้`, 'warning');
          return;
        }
        applyMatchFromSupabase(sbMatch);
        return;
      }
    }
    triggerToast(`ไม่พบข้อมูลแมตช์ #${matchId} ในลีกปัจจุบัน`, 'error');
  };

  // --- Load match from Supabase into scoreboard ---
  const applyMatchFromSupabase = useCallback((match: SupabaseMatch, customTeams?: SupabaseTeam[]) => {
    if (isMatchFinished(match)) {
      triggerToast(`⚠️ แมตช์ #${match.match_number} (${match.team_a_name} vs ${match.team_b_name}) บันทึกผลแล้ว ไม่สามารถโหลดได้`, 'warning');
      return;
    }

    setIsMatchLoaded(true);
    localStorage.setItem('isMatchLoaded', 'true');

    const availableTeams = customTeams || supabaseLeague.teams;
    const teamAName = match.team_a_name || 'Team A';
    const teamBName = match.team_b_name || 'Team B';

    const teamAObj = availableTeams.find(
      (t) => t.id === match.team_a_id || t.name.toLowerCase() === teamAName.toLowerCase()
    );
    const teamBObj = availableTeams.find(
      (t) => t.id === match.team_b_id || t.name.toLowerCase() === teamBName.toLowerCase()
    );

    const initialScoreA = typeof match.score_a === 'number' ? match.score_a : 0;
    const initialScoreB = typeof match.score_b === 'number' ? match.score_b : 0;

    setNameA(teamAName);
    setNameB(teamBName);
    setScoreA(initialScoreA);
    setScoreB(initialScoreB);
    timerHook.resetToZero();
    setMatchIdInput(match.match_number);

    // Resolve logos from Supabase teams > saved logos > team name
    const resolvedLogoA = teamAObj?.logo_url || getTeamLogo(teamAName) || teamAName;
    const resolvedLogoB = teamBObj?.logo_url || getTeamLogo(teamBName) || teamBName;
    setLogoA(resolvedLogoA);
    setLogoB(resolvedLogoB);

    // Resolve colors from Supabase teams > saved team colors > default
    const savedColorsA = getTeamColors(teamAName);
    const savedColorsB = getTeamColors(teamBName);
    const colA1 = teamAObj?.color_primary || savedColorsA.color1 || '#ffffff';
    const colA2 = teamAObj?.color_secondary || savedColorsA.color2 || '#000000';
    const colB1 = teamBObj?.color_primary || savedColorsB.color1 || '#ffffff';
    const colB2 = teamBObj?.color_secondary || savedColorsB.color2 || '#000000';

    setColorA1(colA1);
    setColorA2(colA2);
    setColorB1(colB1);
    setColorB2(colB2);

    // Update OBS
    obs.setText('name_team_a', teamAName.replace(/\//g, '\n'));
    obs.setText('name_team_b', teamBName.replace(/\//g, '\n'));
    obs.setImage('logo_team_a', resolvedLogoA, logoFolderPath);
    obs.setImage('logo_team_b', resolvedLogoB, logoFolderPath);
    obs.setSourceColor('Color_Team_A', colA1);
    obs.setSourceColor('Color_Team_A_2', colA2);
    obs.setSourceColor('Color_Team_B', colB1);
    obs.setSourceColor('Color_Team_B_2', colB2);

    const l1 = match.label1 || '';
    const l2 = match.label2 || '';
    const l3 = match.label3 || '';
    setLabel1(l1);
    setLabel2(l2);
    setLabel3(l3);
    obs.setText('label_1', l1);
    obs.setText('label_2', l2);
    obs.setText('label_3', l3);

    triggerToast(`โหลดแมตช์ #${match.match_number} (${teamAName} vs ${teamBName}) จาก Supabase สำเร็จ`, 'success');
  }, [
    supabaseLeague.teams,
    isMatchFinished,
    setColorA1,
    setColorA2,
    setColorB1,
    setColorB2,
    setLabel1,
    setLabel2,
    setLabel3,
    setLogoA,
    setLogoB,
    setNameA,
    setNameB,
    setScoreA,
    setScoreB,
    getTeamColors,
    getTeamLogo,
    logoFolderPath,
    obs,
    timerHook,
    triggerToast,
  ]);

  // --- Navigate matches by index (prev / next) through pending matches only ---
  const handleNavigateMatch = useCallback((direction: 'prev' | 'next') => {
    const unplayedMatches = supabaseLeague.matches.filter((m) => !isMatchFinished(m));
    if (!unplayedMatches.length) {
      triggerToast('ไม่มีคู่แข่งขันที่รอแข่งในลีกนี้ (บันทึกผลครบแล้ว)', 'warning');
      return;
    }

    const currentIndex = unplayedMatches.findIndex((m) => m.match_number === matchIdInput);
    let targetIndex = 0;

    if (currentIndex === -1) {
      targetIndex = direction === 'next' ? 0 : unplayedMatches.length - 1;
    } else if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    } else {
      targetIndex = currentIndex < unplayedMatches.length - 1 ? currentIndex + 1 : unplayedMatches.length - 1;
    }

    const targetMatch = unplayedMatches[targetIndex];
    if (targetMatch) {
      applyMatchFromSupabase(targetMatch);
    }
  }, [supabaseLeague.matches, matchIdInput, applyMatchFromSupabase, isMatchFinished, triggerToast]);

  const handleLoadLeague = useCallback(async () => {
    const targetId = selectedLeagueIdToLoad || supabaseLeague.activeLeagueId;
    if (!targetId) {
      triggerToast('กรุณาเลือกลีกก่อนกดโหลด', 'error');
      return;
    }
    supabaseLeague.selectLeague(targetId);
    const targetLeague = supabaseLeague.leagues.find((l) => l.id === targetId);
    try {
      const { LeagueService } = await import('../services/leagueService');
      const [teamsData, matchesData] = await Promise.all([
        LeagueService.getTeamsByLeague(targetId),
        LeagueService.getMatchesByLeague(targetId),
      ]);
      const unplayedMatches = matchesData.filter((m) => !isMatchFinished(m));
      if (unplayedMatches.length > 0) {
        applyMatchFromSupabase(unplayedMatches[0], teamsData);
        triggerToast(`โหลดข้อมูลลีก "${targetLeague?.name || ''}" เรียบร้อยแล้ว (พบ ${unplayedMatches.length} คู่ที่รอแข่ง)`, 'success');
      } else if (matchesData.length > 0) {
        triggerToast(`ลีก "${targetLeague?.name || ''}" บันทึกผลครบทุกคู่แล้ว`, 'info');
      } else {
        triggerToast(`เลือกลีก "${targetLeague?.name || ''}" แล้ว (ยังไม่มีแมตช์ในลีก)`, 'info');
      }
    } catch {
      triggerToast(`โหลดข้อมูลลีก "${targetLeague?.name || ''}" เรียบร้อยแล้ว`, 'success');
    }
  }, [selectedLeagueIdToLoad, supabaseLeague, applyMatchFromSupabase, isMatchFinished, triggerToast]);

  // --- Swap Teams ---
  const swapTeams = () => {
    const tempNameA = nameA;
    const tempScoreA = scoreA;
    const tempLogoA = logoA;
    const tempColorA1 = colorA1;
    const tempColorA2 = colorA2;

    setNameA(nameB);
    setScoreA(scoreB);
    setLogoA(logoB);
    setColorA1(colorB1);
    setColorA2(colorB2);

    setNameB(tempNameA);
    setScoreB(tempScoreA);
    setLogoB(tempLogoA);
    setColorB1(tempColorA1);
    setColorB2(tempColorA2);

    obs.setText('name_team_a', nameB.replace(/\//g, '\n'));
    obs.setText('name_team_b', tempNameA.replace(/\//g, '\n'));
    obs.setImage('logo_team_a', logoB, logoFolderPath);
    obs.setImage('logo_team_b', tempLogoA, logoFolderPath);
    obs.setSourceColor('Color_Team_A', colorB1);
    obs.setSourceColor('Color_Team_A_2', colorB2);
    obs.setSourceColor('Color_Team_B', tempColorA1);
    obs.setSourceColor('Color_Team_B_2', tempColorA2);

    triggerToast(trans.toastSwapped, 'info');
  };

  // --- Reset Scores ---
  const resetScore = () => {
    setScoreA(0);
    setScoreB(0);
    triggerToast(trans.toastScoreReset, 'info');
  };

  // --- Save match results to Firebase ---
  const handleSaveMatchToFirebase = (target: FirebaseSaveTarget) => {
    const confirmSave = window.confirm(`${target.name} แน่นะ !! ??`);
    if (!confirmSave) return;

    try {
      const app = getOrCreateFirebaseApp(target);
      const db = getDatabase(app);
      const matchesRef = ref(db, 'matches');

      const matchData = {
        teamA: nameA.replace(/<br\s*\/?>/gi, ' '),
        teamB: nameB.replace(/<br\s*\/?>/gi, ' '),
        logoA: logoA || '',
        logoB: logoB || '',
        scoreA: parseInt(String(scoreA), 10),
        scoreB: parseInt(String(scoreB), 10),
        roundLabel: label2,
        date: new Date().toISOString().slice(0, 10),
        url: ''
      };

      push(matchesRef, matchData)
        .then(() => {
          triggerToast(`บันทึกคะแนน ${target.name} เรียบร้อยแล้ว`, 'success');
        })
        .catch((err) => {
          triggerToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
        });
    } catch (err: any) {
      triggerToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // --- Save match results to Supabase ---
  const handleSaveMatchToSupabase = async () => {
    // 1. Try to find match by number or active league match
    const currentMatch =
      supabaseLeague.matches.find((m) => m.match_number === matchIdInput) ||
      supabaseLeague.matches.find((m) => m.team_a_name === nameA && m.team_b_name === nameB);

    if (currentMatch) {
      try {
        await supabaseLeague.updateMatch(currentMatch.id, {
          score_a: scoreA,
          score_b: scoreB,
          status: 'finished',
        });
        triggerToast(`✓ บันทึกผลแมตช์ #${currentMatch.match_number} (${nameA} ${scoreA} - ${scoreB} ${nameB}) ลง Supabase สำเร็จ!`, 'success');
      } catch (err: any) {
        triggerToast(`บันทึกผลไม่สำเร็จ: ${err.message}`, 'error');
      }
      return;
    }

    // 2. If active league exists but match not found, create new finished match
    if (supabaseLeague.activeLeagueId) {
      try {
        await supabaseLeague.createMatch({
          league_id: supabaseLeague.activeLeagueId,
          match_number: matchIdInput,
          team_a_name: nameA,
          team_b_name: nameB,
          score_a: scoreA,
          score_b: scoreB,
          status: 'finished',
          label1: label1 || 'บันทึกผลการแข่งขัน',
          label2: label2 || '',
          label3: label3 || '',
          match_date: new Date().toISOString(),
        });
        triggerToast(`✓ สร้างและบันทึกผลแมตช์ #${matchIdInput} (${nameA} ${scoreA} - ${scoreB} ${nameB}) ลง Supabase สำเร็จ!`, 'success');
      } catch (err: any) {
        triggerToast(`บันทึกผลไม่สำเร็จ: ${err.message}`, 'error');
      }
      return;
    }

    triggerToast('กรุณาสร้างหรือเลือกลีกในระบบ Supabase ก่อนบันทึกผล', 'error');
  };

  // --- Copy Details announcement template ---
  const getThaiDateString = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH-u-ca-buddhist', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return dateStr;
  };

  const copyDetailsToClipboard = () => {
    if (!detailsTemplate.trim()) {
      triggerToast(trans.toastNoTextToCopy, 'error');
      return;
    }

    const cleanBr = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/&amp;/g, '&');
    const thaiDate = getThaiDateString();

    const filled = detailsTemplate
      .replace(/<TeamA>/gi, cleanBr(nameA))
      .replace(/<TeamB>/gi, cleanBr(nameB))
      .replace(/<score_team_a>/gi, String(scoreA))
      .replace(/<score_team_b>/gi, String(scoreB))
      .replace(/<thai_date>/gi, thaiDate)
      .replace(/<time_counter>/gi, timerHook.formattedTime)
      .replace(/<half_text>/gi, timerHook.half)
      .replace(/<label1>/gi, cleanBr(label1))
      .replace(/<label2>/gi, cleanBr(label2))
      .replace(/<label3>/gi, cleanBr(label3));

    navigator.clipboard
      .writeText(filled)
      .then(() => triggerToast(trans.toastCopied, 'info'))
      .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
  };

  // --- Copy URLs helper for overlays ---
  const getOverlaySearchBase64 = (target: FirebaseSaveTarget) => {
    const encoded = btoa(JSON.stringify(target.firebaseConfig))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return encoded;
  };

  const handleCopyOverlayUrl = (viewType: string, standaloneFile = '') => {
    const host = window.location.origin;
    let urlString = '';

    // 1. Check if Supabase league is active
    if (supabaseLeague.activeLeagueId) {
      const leagueId = supabaseLeague.activeLeagueId;
      const leagueTitle = encodeURIComponent(supabaseLeague.activeLeague?.name || 'League');

      if (standaloneFile === 'league-table' || viewType === 'table') {
        urlString = `${host}/league-table?league=${leagueId}&title=${leagueTitle}`;
      } else if (standaloneFile === 'all-scores' || viewType === 'results') {
        urlString = `${host}/all-scores?league=${leagueId}&title=${leagueTitle}`;
      } else if (standaloneFile === 'all-score-combined' || viewType === 'combined') {
        urlString = `${host}/all-score-combined?league=${leagueId}&title=${leagueTitle}`;
      } else {
        urlString = `${host}/overlay?league=${leagueId}&view=${viewType}&title=${leagueTitle}`;
        if (viewType === 'ticker') {
          urlString += `&date=today&speed=${tickerSpeed}`;
        }
      }

      navigator.clipboard
        .writeText(urlString)
        .then(() => triggerToast('✓ คัดลอก URL เรียบร้อยแล้ว (Supabase)', 'success'))
        .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
      return;
    }

    // 2. Fallback to Firebase
    const target = firebaseTargets.find((t) => t.id === selectedQuickLeagueId) || firebaseTargets[0];
    if (!target) {
      triggerToast('กรุณาสร้างหรือเลือกลีกในระบบ (Supabase / Excel) ก่อนคัดลอก URL', 'error');
      return;
    }

    if (standaloneFile === 'league-table' || viewType === 'table') {
      urlString = `${host}/league-table?league=${target.id}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
    } else if (standaloneFile === 'all-scores' || viewType === 'results') {
      urlString = `${host}/all-scores?league=${target.id}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
    } else if (standaloneFile === 'all-score-combined' || viewType === 'combined') {
      urlString = `${host}/all-score-combined?league=${target.id}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
    } else {
      urlString = `${host}/overlay?league=${target.id}&view=${viewType}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
      if (viewType === 'ticker') {
        urlString += `&date=today&speed=${tickerSpeed}`;
      }
    }

    navigator.clipboard
      .writeText(urlString)
      .then(() => triggerToast(trans.toastCopied, 'success'))
      .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
  };

  // --- OBS Setup Functions ---
  const handleDownloadTemplate = async () => {
    const downloadUrl = `${window.location.origin}/React.json`;

    try {
      // Try to copy URL to clipboard
      await navigator.clipboard.writeText(downloadUrl);
      triggerToast('✓ คัดลอก URL แล้ว! เปิด Chrome แล้ว Paste (Ctrl+V) ที่ Address Bar', 'success');

      // Also try to open in new window (may work in some cases)
      const newWindow = window.open(downloadUrl, '_blank');
      if (!newWindow) {
        // If popup blocked, show instructions
        console.log('Popup blocked, URL copied to clipboard:', downloadUrl);
      }
    } catch {
      // Fallback: show the URL in a modal
      const message = `คัดลอก URL นี้แล้ววางใน Chrome:\n\n${downloadUrl}\n\nหรือ Ctrl+C เพื่อคัดลอก`;

      if (window.confirm(message)) {
        // User clicked OK, try to copy again
        try {
          await navigator.clipboard.writeText(downloadUrl);
          triggerToast('✓ คัดลอก URL แล้ว!', 'success');
        } catch {
          triggerToast('กรุณาคัดลอก URL จาก console', 'info');
          console.log('Download URL:', downloadUrl);
        }
      }
    }
  };

  const handleVideoFolderConnect = async () => {
    const result = await videoFolder.connect();
    if (result.success) {
      const pathInfo = videoFolder.savedPath ? ` (${videoFolder.savedPath})` : '';
      triggerToast(
        `เชื่อมต่อโฟลเดอร์ "${result.folderName || videoFolder.folderName}" แล้ว${pathInfo} · ${result.fileCount ?? videoFolder.videoFiles.length} ไฟล์`,
        'success'
      );
      if (result.pathMismatch && videoFolder.savedPath) {
        triggerToast(
          `อัปเดต path: "${videoFolder.savedPath}" → "${result.folderName}"`,
          'info'
        );
      }
    } else if (result.error) {
      triggerToast(result.error, 'error');
    }
  };

  const handleVideoFolderReset = async () => {
    await videoFolder.clearStoredFolder();
    triggerToast('ลืมโฟลเดอร์วิดีโอแล้ว - คลิกปุ่ม Video เพื่อเลือกใหม่', 'info');
  };

  const closePenaltyModal = () => {
    setShowPenaltyModal(false);
    obs.getSceneItemId('Main Stream', 'Penalty').then((id) => {
      if (id !== null) obs.setSceneItemEnabled('Main Stream', id, false);
    });
    obs.getSceneItemId('Main Stream', 'Main_events').then((id) => {
      if (id !== null) obs.setSceneItemEnabled('Main Stream', id, true);
    });
  };

  const handleOpenPenaltyShootout = async () => {
    broadcastScoreboardButton('penalty_shootout');
    const defaultPenaltyScene = {
      sceneName: 'Main Stream',
      showSources: 'Penalty',
      hideSources: 'Main_events,Standings,Goal_Alert',
    };
    let penaltyScene = defaultPenaltyScene;
    try {
      const saved = localStorage.getItem('penalty_obs_scene');
      if (saved) penaltyScene = { ...defaultPenaltyScene, ...JSON.parse(saved) };
    } catch {
      // Use defaults when the saved scene configuration is invalid.
    }

    const sceneName = penaltyScene.sceneName || defaultPenaltyScene.sceneName;
    const showList = penaltyScene.showSources.split(',').map((source) => source.trim()).filter(Boolean);
    const hideList = penaltyScene.hideSources.split(',').map((source) => source.trim()).filter(Boolean);

    try {
      for (const source of showList) {
        const id = await obs.getSceneItemId(sceneName, source);
        if (id !== null) await obs.setSceneItemEnabled(sceneName, id, true);
      }
      for (const source of hideList) {
        const id = await obs.getSceneItemId(sceneName, source);
        if (id !== null) await obs.setSceneItemEnabled(sceneName, id, false);
      }
    } catch (err) {
      console.error('[Scoreboard] Error toggling sources:', err);
    }

    setShowPenaltyModal(true);
  };

  const handleHideTimer = () => {
    timerHook.pause();
    obs.setText('time_counter', '');
    obs.setText('half_text', '');
    broadcastScoreboardButton('pause_timer');
  };

  return (
    <div className="container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-color)' }}>
          {supabaseLeague.activeLeague?.name || 'Football Scoreboard Controller'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className={`video-folder-status ${videoFolder.isConnected ? 'is-connected' : 'is-disconnected'}`}
              onClick={() => void handleVideoFolderConnect()}
              disabled={videoFolder.isConnecting}
              title={
                videoFolder.isConnected
                  ? `โฟลเดอร์: ${videoFolder.folderName}\nPath: ${videoFolder.savedPath || 'ไม่ได้ระบุ'}\n\nคลิกเพื่อเปลี่ยนโฟลเดอร์`
                  : 'คลิกเพื่อเลือกโฟลเดอร์วิดีโอ OBS Replay'
              }
            >
              <span className="video-folder-status-dot" />
              {videoFolder.isConnecting ? (
                <span>Connecting ....</span>
              ) : videoFolder.isConnected ? (
                <span>
                  📂 {videoFolder.savedPath || videoFolder.folderName} ({videoFolder.videoFiles.length} files)
                </span>
              ) : (
                <span>Status OFF</span>
              )}
            </button>
            {videoFolder.isConnected && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleVideoFolderReset()}
                style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }}
                title="รีเซ็ตและเลือกโฟลเดอร์ใหม่"
              >
                ✕
              </button>
            )}
          </div>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <UserAvatar user={currentUser} size={22} />
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
                {currentUser.email}
              </span>
              {authAccess?.accessType === 'trial' && authAccess.trialExpiresAt && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#7dd3fc',
                    background: 'rgba(14, 165, 233, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    whiteSpace: 'nowrap',
                  }}
                  title="ระยะเวลาทดลองใช้งานฟรี 7 วัน"
                >
                  🎁 {formatTrialRemaining(authAccess.trialExpiresAt)}
                </span>
              )}
              {isSuperAdmin(currentUser.email) && (
                <button
                  onClick={() => navigate('/admin/whitelist')}
                  className="btn-primary"
                  style={{ padding: '3px 8px', fontSize: '0.72rem', marginLeft: '2px' }}
                  title="จัดการ Whitelist"
                >
                  🛡️ Whitelist
                </button>
              )}
              <button
                onClick={() => logoutUser()}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem', marginLeft: '2px' }}
                title="ออกจากระบบ"
              >
                <i className="fas fa-sign-out-alt"></i> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2-Step Setup Onboarding Wizard Gate */}
      {!isSetupComplete ? (
        <div className="card" style={{ padding: '24px', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', marginTop: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <i className="fas fa-rocket"></i> เริ่มต้นตั้งค่าใช้งาน Scoreboard Controller
            </h2>
            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              กรุณาทำตามขั้นตอน <strong>2 ข้อแรก</strong> ด้านล่างให้ครบเพื่อปลดล็อกแผงควบคุมหลัก
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* Step 1 Card */}
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: isStep1Complete ? 'rgba(6, 78, 59, 0.4)' : '#1e293b',
              border: isStep1Complete ? '1px solid #10b981' : '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                    1️⃣ Connect Video Folder
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: isStep1Complete ? '#065f46' : '#991b1b',
                    color: isStep1Complete ? '#6ee7b7' : '#fca5a5',
                    fontWeight: 600
                  }}>
                    {isStep1Complete ? '🟢 เชื่อมต่อแล้ว' : '🔴 ยังไม่เชื่อมต่อ'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                  เลือกโฟลเดอร์คลิปวิดีโอ OBS Replay เพื่อรองรับระบบ Instant Replay และ VAR
                </p>
              </div>
              <button
                type="button"
                className={isStep1Complete ? 'btn-secondary' : 'btn-primary'}
                onClick={() => void handleVideoFolderConnect()}
                disabled={videoFolder.isConnecting}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {videoFolder.isConnecting ? '⏳ กำลังเชื่อมต่อ...' : isStep1Complete ? '🔄 เปลี่ยนโฟลเดอร์' : '📂 เลือกโฟลเดอร์วิดีโอ'}
              </button>
            </div>

            {/* Step 2 Card */}
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: isStep2Complete ? 'rgba(6, 78, 59, 0.4)' : '#1e293b',
              border: isStep2Complete ? '1px solid #10b981' : '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                    2️⃣ เลือก/สร้างลีกการแข่งขัน (Supabase)
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: isStep2Complete ? '#065f46' : '#991b1b',
                    color: isStep2Complete ? '#6ee7b7' : '#fca5a5',
                    fontWeight: 600
                  }}>
                    {isStep2Complete ? '🟢 พร้อมใช้งาน' : '🔴 ยังไม่เลือกลีก'}
                  </span>
                </div>
              </div>

              {supabaseLeague.leagues.length > 0 ? (
                <>
                  {/* มีลีกอยู่แล้ว: แสดง Dropdown เลือกลีก */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>เลือกลีกของคุณ:</label>
                    <select
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '0.88rem',
                        background: '#0f172a',
                        color: '#38bdf8',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      value={supabaseLeague.activeLeagueId || ''}
                      onChange={(e) => {
                        const newId = e.target.value;
                        if (newId) {
                          supabaseLeague.selectLeague(newId);
                          setSelectedLeagueIdToLoad(newId);
                        }
                      }}
                    >
                      <option value="">-- โปรดเลือกลีก --</option>
                      {supabaseLeague.leagues.map((league) => (
                        <option key={league.id} value={league.id}>
                          🏆 {league.name} {league.season ? `(${league.season})` : ''}
                        </option>
                      ))}
                    </select>

                    {supabaseLeague.activeLeague && (
                      <p style={{ fontSize: '0.8rem', color: '#6ee7b7', margin: 0, lineHeight: 1.4 }}>
                        ✅ ลีกปัจจุบัน: <strong>{supabaseLeague.activeLeague.name}</strong>
                        {supabaseLeague.teams.length > 0 && ` (${supabaseLeague.teams.length} ทีม, ${supabaseLeague.matches.length} แมตช์)`}
                      </p>
                    )}
                  </div>

                  {/* ปุ่ม 2 ปุ่ม */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setLeagueModalInitialTab('matches');
                        setShowLeagueManagementModal(true);
                      }}
                      style={{ flex: 1, minWidth: '160px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="fas fa-trophy" style={{ color: '#f59e0b' }}></i>
                      <span>🏆 จัดการลีก / สลับคู่แข่งขัน</span>
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setLeagueModalInitialTab('league');
                        setShowLeagueManagementModal(true);
                      }}
                      style={{ minWidth: '140px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="fas fa-plus-circle"></i>
                      <span>➕ สร้างลีกใหม่</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* ยังไม่มีลีก: แสดงข้อความแนะนำ + ปุ่มสร้างลีก */}
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 4px 0' }}>
                      📋 ยังไม่มีข้อมูลลีกการแข่งขันสำหรับบัญชีนี้
                    </p>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                      สร้างลีกแรกของคุณเพื่อเริ่มจัดการตารางแข่งขันและทีมผ่าน Supabase
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setLeagueModalInitialTab('league');
                      setShowLeagueManagementModal(true);
                    }}
                    style={{ width: '100%', padding: '12px 14px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', cursor: 'pointer' }}
                  >
                    <i className="fas fa-plus-circle"></i>
                    <span>➕ สร้างลีกการแข่งขันใหม่ (Supabase)</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            💡 ทำครบทั้ง 2 ขั้นตอนด้านบนแล้ว ระบบจะเปิดแผงควบคุม Scoreboard ทั้งหมดให้อัตโนมัติ
          </div>
        </div>
      ) : (
        <>
          {/* Controls Bar */}
          <div className="card" style={{ padding: '8px 12px' }}>
            <div className="row space-between" style={{ gap: '8px', marginBottom: 0 }}>
              <div className="row" style={{ marginBottom: 0, gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowLeagueManagementModal(true)}
                  title="จัดการข้อมูลลีก รายชื่อทีม และตารางการแข่งขันผ่าน Supabase"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', fontWeight: 600 }}
                >
                  <i className="fas fa-trophy" style={{ fontSize: '0.9rem', color: '#f59e0b' }}></i>
                  <span>🏆 จัดการลีก</span>
                </button>

                {/* League Selector Dropdown */}
                <select
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.82rem',
                    background: '#0f172a',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    minWidth: '150px',
                    maxWidth: '220px',
                    fontWeight: 600
                  }}
                  value={supabaseLeague.activeLeagueId || selectedLeagueIdToLoad}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedLeagueIdToLoad(newId);
                    if (newId) {
                      supabaseLeague.selectLeague(newId);
                    }
                  }}
                  title="เลือกลีกจากฐานข้อมูล Supabase"
                >
                  <option value="">-- โปรดเลือกลีก --</option>
                  {supabaseLeague.leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} {league.season ? `(${league.season})` : ''}
                    </option>
                  ))}
                </select>

                {/* Load Button */}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => void handleLoadLeague()}
                  disabled={(!selectedLeagueIdToLoad && !supabaseLeague.activeLeagueId) || supabaseLeague.loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#059669',
                    borderColor: '#059669',
                    fontWeight: 600,
                    cursor: (selectedLeagueIdToLoad || supabaseLeague.activeLeagueId) ? 'pointer' : 'not-allowed'
                  }}
                  title="โหลดข้อมูลตารางแข่งและรายชื่อทีมของลีกที่เลือก"
                >
                  <i className={supabaseLeague.loading ? "fas fa-spinner fa-spin" : "fas fa-download"}></i>
                  <span>{supabaseLeague.loading ? 'กำลังโหลด...' : 'Load'}</span>
                </button>

                {/* Matches Dropdown (shown when matches exist in active league) */}
                {supabaseLeague.matches.length > 0 && (
                  pendingMatches.length > 0 ? (
                    <select
                      style={{
                        padding: '5px 8px',
                        fontSize: '0.82rem',
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        maxWidth: '280px'
                      }}
                      value={pendingMatches.some((m) => m.match_number === matchIdInput) ? matchIdInput : ''}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        if (num) {
                          setMatchIdInput(num);
                          const matchObj = pendingMatches.find((m) => m.match_number === num);
                          if (matchObj) applyMatchFromSupabase(matchObj);
                        }
                      }}
                      title="เลือกคู่แข่งขัน (เฉพาะคู่ที่ยังไม่ได้บันทึกผล)"
                    >
                      <option value="" disabled>-- เลือกคู่แข่งขัน (รอแข่ง) --</option>
                      {pendingMatches.map((m) => (
                        <option key={m.id} value={m.match_number}>
                          #{m.match_number}: {m.team_a_name} vs {m.team_b_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: '#4ade80',
                        fontWeight: 600,
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(74, 222, 128, 0.1)',
                        borderRadius: '4px',
                        border: '1px solid rgba(74, 222, 128, 0.2)'
                      }}
                      title="แมตช์ทั้งหมดในลีกนี้ได้รับการบันทึกผลคะแนนเรียบร้อยแล้ว"
                    >
                      <i className="fas fa-check-circle"></i> บันทึกผลครบทุกคู่แล้ว
                    </span>
                  )
                )}
              </div>

              <div className="row" style={{ marginBottom: 0, gap: '4px' }}>
                <label htmlFor="matchIDInput" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{trans.matchId}</label>
                <button
                  onClick={() => handleNavigateMatch('prev')}
                  style={{ padding: '3px 8px', background: '#333', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                  title="แมตช์ก่อนหน้า"
                >
                  &lt;
                </button>
                <input
                  type="number"
                  id="matchIDInput"
                  min="1"
                  value={matchIdInput}
                  onChange={(e) => setMatchIdInput(parseInt(e.target.value, 10) || 1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value, 10) || 1;
                      applyMatch(val);
                    }
                  }}
                  style={{ width: '48px', padding: '3px 6px', fontSize: '0.85rem', textAlign: 'center' }}
                  title="พิมพ์หมายเลขแมตช์แล้วกด Enter เพื่อโหลด"
                />
                <button
                  onClick={() => handleNavigateMatch('next')}
                  style={{ padding: '3px 8px', background: '#333', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                  title="แมตช์ถัดไป"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          {/* Team score and editor panel */}
          <div className="card" style={{ padding: '12px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap', minWidth: '540px' }}>
              {/* Score Team A */}
              <div className="score-buttons" style={{ flexShrink: 0 }}>
                <button className="plus" onClick={() => addGoal('A', 'manual')}>+</button>
                <button className="minus" onClick={() => setScoreA((prev) => Math.max(0, prev - 1))}>-</button>
              </div>

              <div className="score-display" style={{ flexShrink: 0 }}>{scoreA}</div>

              {/* Team Row A */}
              <div className="team-row" style={{ flex: '1 1 0%', minWidth: '120px' }}>
                <div className="color-picker-stack">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      className="color-picker"
                      value={colorA1}
                      onChange={(e) => {
                        setColorA1(e.target.value);
                        obs.setSourceColor('Color_Team_A', e.target.value);
                        saveTeamColors(nameA, { color1: e.target.value, color2: colorA2 });
                      }}
                    />
                    <input
                      type="color"
                      className="color-picker"
                      value={colorA2}
                      onChange={(e) => {
                        setColorA2(e.target.value);
                        obs.setSourceColor('Color_Team_A_2', e.target.value);
                        saveTeamColors(nameA, { color1: colorA1, color2: e.target.value });
                      }}
                    />
                  </div>
                  {/* Quick colors */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    {['#98F527', '#FFEF00', '#F52727'].map((c) => (
                      <div
                        key={c}
                        className="quick-color-box"
                        style={{ background: c }}
                        onClick={() => {
                          setColorA1(c);
                          obs.setSourceColor('Color_Team_A', c);
                          saveTeamColors(nameA, { color1: c, color2: colorA2 });
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="logo-container" title="คลิกเพื่อจัดการรายชื่อทีมและอัปโหลดโลโก้ (Supabase)" onClick={() => setShowLeagueManagementModal(true)}>
                  {logoA || nameA ? (
                    <img
                      key={`${logoA}-${nameA}-${teamsCacheVersion}`}
                      src={getLogoSrc(logoA, nameA)}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="logo-initials">{getTeamInitials(nameA)}</div>
                </div>

                <div className="name-control-area">
                  {isEditingA ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input
                        type="text"
                        value={editNameAVal}
                        onChange={(e) => setEditNameAVal(e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <button
                        className="btn-success"
                        onClick={() => {
                          setNameA(editNameAVal);
                          setIsEditingA(false);
                          obs.setText('name_team_a', editNameAVal.replace(/\//g, '\n'));
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="name">{renderTeamName(nameA)}</div>
                      <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ flex: 1, maxWidth: '90px' }}
                          onClick={() => {
                            setEditNameAVal(nameA);
                            setIsEditingA(true);
                          }}
                        >
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                        {supabaseLeague.teams.length > 0 && (
                          <button
                            className="btn-primary"
                            style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                            title="เลือกทีมจากรายชื่อใน Supabase"
                            onClick={() => {
                              setTeamSelectTarget('A');
                              setTeamSelectSearch('');
                              setShowTeamSelectModal(true);
                            }}
                          >
                            <i className="fas fa-users"></i>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Center Swapper */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  className="btn-warning"
                  onClick={swapTeams}
                  style={{ height: '42px', width: '42px', borderRadius: '50%', fontSize: '1.1rem' }}
                >
                  <i className="fas fa-exchange-alt"></i>
                </button>
                <button className="btn-secondary" onClick={resetScore} style={{ borderRadius: '20px', fontSize: '0.75rem' }}>
                  <i className="fas fa-sync-alt"></i>
                  <span>{trans.reset}</span>
                </button>
              </div>

              {/* Team Row B */}
              <div className="team-row" style={{ flex: '1 1 0%', minWidth: '120px' }}>
                <div className="color-picker-stack">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      className="color-picker"
                      value={colorB1}
                      onChange={(e) => {
                        setColorB1(e.target.value);
                        obs.setSourceColor('Color_Team_B', e.target.value);
                        saveTeamColors(nameB, { color1: e.target.value, color2: colorB2 });
                      }}
                    />
                    <input
                      type="color"
                      className="color-picker"
                      value={colorB2}
                      onChange={(e) => {
                        setColorB2(e.target.value);
                        obs.setSourceColor('Color_Team_B_2', e.target.value);
                        saveTeamColors(nameB, { color1: colorB1, color2: e.target.value });
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    {['#98F527', '#FFEF00', '#F52727'].map((c) => (
                      <div
                        key={c}
                        className="quick-color-box"
                        style={{ background: c }}
                        onClick={() => {
                          setColorB1(c);
                          obs.setSourceColor('Color_Team_B', c);
                          saveTeamColors(nameB, { color1: c, color2: colorB2 });
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="logo-container" title="คลิกเพื่อจัดการรายชื่อทีมและอัปโหลดโลโก้ (Supabase)" onClick={() => setShowLeagueManagementModal(true)}>
                  {logoB || nameB ? (
                    <img
                      key={`${logoB}-${nameB}-${teamsCacheVersion}`}
                      src={getLogoSrc(logoB, nameB)}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="logo-initials">{getTeamInitials(nameB)}</div>
                </div>

                <div className="name-control-area">
                  {isEditingB ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <input
                        type="text"
                        value={editNameBVal}
                        onChange={(e) => setEditNameBVal(e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <button
                        className="btn-success"
                        onClick={() => {
                          setNameB(editNameBVal);
                          setIsEditingB(false);
                          obs.setText('name_team_b', editNameBVal.replace(/\//g, '\n'));
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="name">{renderTeamName(nameB)}</div>
                      <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ flex: 1, maxWidth: '90px' }}
                          onClick={() => {
                            setEditNameBVal(nameB);
                            setIsEditingB(true);
                          }}
                        >
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                        {supabaseLeague.teams.length > 0 && (
                          <button
                            className="btn-primary"
                            style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                            title="เลือกทีมจากรายชื่อใน Supabase"
                            onClick={() => {
                              setTeamSelectTarget('B');
                              setTeamSelectSearch('');
                              setShowTeamSelectModal(true);
                            }}
                          >
                            <i className="fas fa-users"></i>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="score-display" style={{ flexShrink: 0 }}>{scoreB}</div>

              <div className="score-buttons" style={{ flexShrink: 0 }}>
                <button className="plus" onClick={() => addGoal('B', 'manual')}>+</button>
                <button className="minus" onClick={() => setScoreB((prev) => Math.max(0, prev - 1))}>-</button>
              </div>
            </div>
          </div>
          <ScoreboardTimerPanel
            timer={timerHook}
            onOpenPresetTime={() => setShowPresetTimeModal(true)}
            onHideTime={handleHideTimer}
            onPenaltyShootout={() => void handleOpenPenaltyShootout()}
            onOpenVarReplay={() => {
              broadcastScoreboardButton('var_replay');
              setShowVarReplayV2Modal(true);
            }}
            onOpenInstantReplay={() => {
              broadcastScoreboardButton('instant_replay');
              setShowInstantReplayModal(true);
            }}
          />

          {/* Match save triggers dynamically */}
          {/* Match save triggers dynamically (Supabase & Firebase) */}
          <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', textAlign: 'center', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <i className="fas fa-save" style={{ color: '#38bdf8' }}></i>
              <span>บันทึกผลการแข่งขัน (Save Match Score):</span>
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {supabaseLeague.activeLeague ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveMatchToSupabase}
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', padding: '10px 22px', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)', cursor: 'pointer' }}
                >
                  <i className="fas fa-check-circle" style={{ fontSize: '1.1rem', color: '#6ee7b7' }}></i>
                  <span>💾 บันทึกผลแมตช์ #{matchIdInput} ลง {supabaseLeague.activeLeague.name} ({scoreA} - {scoreB})</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowLeagueManagementModal(true)}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', padding: '8px 16px', fontWeight: 600 }}
                >
                  <i className="fas fa-trophy"></i> เลือกลีก Supabase เพื่อเปิดใช้ปุ่มบันทึกผลบอล
                </button>
              )}

              {firebaseTargets.map((target) => (
                <button key={target.id} className="btn-secondary" onClick={() => handleSaveMatchToFirebase(target)} style={{ fontSize: '0.85rem' }}>
                  <i className="fas fa-fire"></i> บันทึกไปยัง Firebase ({target.name})
                </button>
              ))}
            </div>
          </div>

          {/* Footer Settings & Buttons */}
          <div className="card">
            <div className="row center" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn-primary" title="Quick Setup" onClick={() => setShowQuickSetupModal(true)}>
                <i className="fas fa-sliders"></i>
                <span>Quick Setup</span>
              </button>
              <button className="btn-primary" title="Auto Macros" onClick={() => setShowAutoMacrosModal(true)}>
                <i className="fas fa-magic"></i>
                <span>Auto Macros</span>
              </button>
              <button className="btn-primary" title={trans.settings} onClick={() => setShowSettingsModal(true)}>
                <i className="fas fa-cog"></i>
                <span>{trans.settings}</span>
              </button>
              <button className="btn-danger" title="คัดลอกข้อความ" onClick={copyDetailsToClipboard}>
                <i className="fas fa-copy"></i>
                <span>คัดลอกข้อความ</span>
              </button>
            </div>
          </div>

          {/* Labels display bar */}
          {(Boolean(label1 || label2 || label3) || supabaseLeague.matches.length > 0) && (
            <div className="card" style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px', background: '#0f1115', padding: '4px 8px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                  <strong>Label 1:</strong> {label1 || '-'}
                </div>
                <div style={{ flex: 1, minWidth: '180px', background: '#0f1115', padding: '4px 8px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                  <strong>Label 2:</strong> {label2 || '-'}
                </div>
                <div style={{ flex: 1, minWidth: '180px', background: '#0f1115', padding: '4px 8px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                  <strong>Label 3:</strong> {label3 || '-'}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Suspense fallback={null}>
        {showSettingsModal && <ScoreboardSettingsModal
          isOpen={showSettingsModal}
          trans={trans}
          detailsTemplate={detailsTemplate}
          nameA={nameA}
          nameB={nameB}
          scoreA={scoreA}
          scoreB={scoreB}
          formattedTime={timerHook.formattedTime}
          half={timerHook.half}
          label1={label1}
          label2={label2}
          label3={label3}
          onTemplateChange={setDetailsTemplate}
          onSave={() => {
            localStorage.setItem('detailsText', detailsTemplate);
            setShowSettingsModal(false);
            triggerToast(trans.toastSaved, 'success');
          }}
          onClose={() => setShowSettingsModal(false)}
        />}

        {/* --- Logo Upload & Path Settings Modal --- */}
        {showLogoPathModal && (
          <div className="modal-overlay" onClick={() => setShowLogoPathModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <h3>
                <i className="fas fa-upload"></i> {trans.logoPathTitle || 'อัปโหลดและจัดการโลโก้'}
              </h3>
              <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>
                {trans.logoPathDesc || 'อัปโหลดโลโก้ผ่าน Cloudinary / Firebase หรือใส่ URL โลโก้ของทีม مباشرة'}
              </p>

              {/* Direct URL Inputs for Team A and Team B */}
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                    🖼️ URL โลโก้ Team A ({nameA}):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                      placeholder="https://res.cloudinary.com/..."
                      value={logoA}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLogoA(val);
                        if (val.startsWith('http')) saveTeamLogo(nameA, val);
                      }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setLogoA(text);
                            saveTeamLogo(nameA, text);
                            triggerToast('วาง URL ให้ Team A เรียบร้อย', 'success');
                          }
                        } catch {
                          triggerToast('อ่านคลิปบอร์ดล้มเหลว', 'error');
                        }
                      }}
                    >
                      📋 วาง URL
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                    🖼️ URL โลโก้ Team B ({nameB}):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                      placeholder="https://res.cloudinary.com/..."
                      value={logoB}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLogoB(val);
                        if (val.startsWith('http')) saveTeamLogo(nameB, val);
                      }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setLogoB(text);
                            saveTeamLogo(nameB, text);
                            triggerToast('วาง URL ให้ Team B เรียบร้อย', 'success');
                          }
                        } catch {
                          triggerToast('อ่านคลิปบอร์ดล้มเหลว', 'error');
                        }
                      }}
                    >
                      📋 วาง URL
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                  📁 โฟลเดอร์รูปในเครื่อง (เฉพาะ Dev mode):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                  value={logoFolderPath}
                  onChange={(e) => setLogoFolderPath(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                  🎬 Path โฟลเดอร์วิดีโอ (สำหรับอ้างอิง):
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                    placeholder="เช่น D:\OBS_football\replays หรือ C:\Users\YourName\Videos"
                    value={videoFolder.savedPath}
                    onChange={(e) => videoFolder.setSavedPath(e.target.value)}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => void handleVideoFolderReset()}
                    title="ล้าง path และเลือกโฟลเดอร์ใหม่"
                  >
                    🗑️
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '4px', marginBottom: 0 }}>
                  💡 <strong>สำคัญ:</strong> Path นี้เป็นเพียงข้อมูลอ้างอิง ไม่ใช่ path จริง!<br />
                  <span style={{ color: '#6ee7b7' }}>ระบบจะจำโฟลเดอร์ที่คุณ "คลิกเลือก" ผ่านปุ่ม Video อัตโนมัติ</span><br />
                  <span style={{ color: '#fbbf24' }}>⚡ สำหรับผู้ใช้หลายคน: แต่ละคนเลือก path ของตัวเองได้ไม่ต้องตั้งค่าล่วงหน้า</span>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    localStorage.setItem('logoFolderPath', logoFolderPath);
                    videoFolder.savePathToStorage();
                    setShowLogoPathModal(false);
                    triggerToast(trans.toastSaved, 'success');
                  }}
                >
                  {trans.save}
                </button>
                <button className="btn-secondary" onClick={() => setShowLogoPathModal(false)}>
                  {trans.close}
                </button>
              </div>

              {/* Logo Uploader Component */}
              <LogoUploader
                onUploadSuccess={(fileName, url, targetTeam) => {
                  triggerToast(`✅ อัปโหลด ${fileName} สำเร็จ!`, 'success');
                  if (targetTeam === 'B') {
                    setLogoB(url);
                    saveTeamLogo(nameB, url);
                    obs.setImage('logo_team_b', url, logoFolderPath);
                    triggerToast(`ตั้งค่าโลโก้ Team B (${nameB}) เป็นรูปภาพ Cloud แล้ว`, 'info');
                  } else {
                    setLogoA(url);
                    saveTeamLogo(nameA, url);
                    obs.setImage('logo_team_a', url, logoFolderPath);
                    triggerToast(`ตั้งค่าโลโก้ Team A (${nameA}) เป็นรูปภาพ Cloud แล้ว`, 'info');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* --- Batch Team Logos Manager Modal --- */}
        {showTeamLogosManagerModal && <TeamLogosManagerModal
          isOpen={showTeamLogosManagerModal}
          onClose={() => setShowTeamLogosManagerModal(false)}
          teamList={allUniqueTeams}
          db={activeDb}
          leagueName={supabaseLeague.activeLeague?.name || 'Football League'}
          logoFolderPath={logoFolderPath}
          onLogoFolderPathChange={setLogoFolderPath}
          onToast={triggerToast}
        />}

        {showPresetTimeModal && <PresetTimeModal
          isOpen={showPresetTimeModal}
          minutes={customTimeMinutes}
          seconds={customTimeSeconds}
          title={trans.timeSettingsTitle || 'ปรับแต่งเวลาเริ่มต้นครึ่งหลัง'}
          closeLabel={trans.close}
          onMinutesChange={setCustomTimeMinutes}
          onSecondsChange={setCustomTimeSeconds}
          onSetPreset={(minutes) => {
            timerHook.setCountdownStartTime(minutes * 60);
            setShowPresetTimeModal(false);
            triggerToast(`ตั้งเวลาครึ่งหลังเป็น ${minutes} นาทีแล้ว`, 'success');
          }}
          onSetCountdown={(totalSeconds, applyNow) => {
            timerHook.setCountdownStartTime(totalSeconds);
            if (applyNow) timerHook.setTimerValue(totalSeconds);
            setShowPresetTimeModal(false);
            triggerToast(
              applyNow
                ? `ตั้งและใช้งานเวลา ${customTimeMinutes} นาที ${customTimeSeconds} วินาทีทันที`
                : `ตั้งเวลาเป็น ${customTimeMinutes} นาที ${customTimeSeconds} วินาทีแล้ว`,
              'success',
            );
          }}
          onClose={() => setShowPresetTimeModal(false)}
        />}

        {showQuickSetupModal && <QuickSetupModal
          isOpen={showQuickSetupModal}
          targets={firebaseTargets}
          selectedTargetId={selectedQuickLeagueId}
          tickerSpeed={tickerSpeed}
          closeLabel={trans.close}
          onTargetChange={setSelectedQuickLeagueId}
          onTickerSpeedChange={(speed) => {
            setTickerSpeed(speed);
            localStorage.setItem('tickerSpeed', String(speed));
          }}
          teamNameSettings={teamNameSettings}
          teamNameUrls={teamNameUrls}
          teamNameObsBusy={teamNameObsBusy}
          teamNameObsConnected={obs.isConnected}
          teamNameObsMessage={teamNameObsMessage}
          onTeamNameSettingsChange={updateTeamNameSettings}
          onCopyTeamNameUrl={copyTeamNameUrl}
          scoreSettings={scoreSettings}
          scoreUrls={scoreUrls}
          onScoreSettingsChange={updateScoreSettings}
          onCopyScoreUrl={copyScoreUrl}
          scoreObsBusy={scoreObsBusy}
          scoreObsMessage={scoreObsMessage}
          logoSettings={logoSettings}
          logoUrls={logoUrls}
          logoObsBusy={logoObsBusy}
          logoObsConnected={obs.isConnected}
          logoObsMessage={logoObsMessage}
          onLogoSettingsChange={updateLogoSettings}
          onCopyLogoUrl={copyLogoUrl}
          onQuickAddLogo={() => void runLogoObsAction('add')}
          onQuickAddScore={() => void runScoreObsAction('add')}
          onQuickAddTeamNames={() => void runTeamNameObsAction('add')}
          onOpenObsSetup={() => {
            setShowQuickSetupModal(false);
            setShowOBSSetupModal(true);
          }}
          onCopyOverlay={handleCopyOverlayUrl}
          onOpenLeagueManager={() => {
            setShowQuickSetupModal(false);
            setShowLeagueManagementModal(true);
          }}
          onOpenDatabase={() => {
            if (!selectedQuickLeagueId) {
              triggerToast('กรุณาเลือกลีกก่อน', 'error');
              return;
            }
            setShowQuickSetupModal(false);
            setShowDatabaseModal(true);
            database.loadMatches();
          }}
          onClose={() => setShowQuickSetupModal(false)}
        />}

        {showOBSSetupModal && <ObsSetupModal
          isOpen={showOBSSetupModal}
          closeLabel={trans.close}
          onDownload={handleDownloadTemplate}
          onClose={() => setShowOBSSetupModal(false)}
        />}

        {showDatabaseModal && <DatabaseMatchesModal
          isOpen={showDatabaseModal}
          isLoading={database.isLoading}
          matches={database.matches}
          searchTerm={database.searchTerm}
          dateFilter={database.dateFilter}
          onSearchChange={database.setSearchTerm}
          onDateFilterChange={database.setDateFilter}
          onRefresh={database.loadMatches}
          onEdit={database.openEdit}
          onDelete={database.deleteMatch}
          onCopyTableUrl={() => handleCopyOverlayUrl('table', 'league-table')}
          onCopyResultsUrl={() => handleCopyOverlayUrl('results', 'all-scores')}
          onClose={() => setShowDatabaseModal(false)}
          closeLabel={trans.close}
        />}
        {database.editingMatch && <EditDatabaseMatchModal
          match={database.editingMatch}
          onSave={database.saveEditedMatch}
          onClose={database.closeEdit}
          saveLabel={trans.save}
        />}

        {(showHelpModal || showDonateModal || showChangelogModal) && <ScoreboardInfoModals
          trans={trans}
          showHelp={showHelpModal}
          showDonate={showDonateModal}
          showChangelog={showChangelogModal}
          onCloseHelp={() => setShowHelpModal(false)}
          onCloseDonate={() => setShowDonateModal(false)}
          onCloseChangelog={() => setShowChangelogModal(false)}
        />}

        {showTeamSelectModal && <TeamSelectModal
          isOpen={showTeamSelectModal}
          target={teamSelectTarget}
          search={teamSelectSearch}
          teams={supabaseLeague.teams}
          closeLabel={trans.close}
          onSearchChange={setTeamSelectSearch}
          onSelect={(selectedTeam) => {
            applyTeamFromSupabase(selectedTeam, teamSelectTarget);
          }}
          onClose={() => setShowTeamSelectModal(false)}
        />}

        <ReplayControlModals
          showVarReplayV2={showVarReplayV2Modal}
          showInstantReplay={showInstantReplayModal}
          onCloseVarReplayV2={() => setShowVarReplayV2Modal(false)}
          onCloseInstantReplay={() => setShowInstantReplayModal(false)}
        />

        {showPenaltyModal && <PenaltyShootoutModal
          isOpen={showPenaltyModal}
          obs={obs}
          teamNameA={nameA}
          teamNameB={nameB}
          onClose={closePenaltyModal}
        />}

        {/* Auto Macros Panel */}
        {showAutoMacrosModal && (
          <AutoMacrosPanel
            obs={obs}
            onClose={() => setShowAutoMacrosModal(false)}
            customMacrosHook={autoMacros}
          />
        )}

        {showLeagueManagementModal && <LeagueManagementModal
          isOpen={showLeagueManagementModal}
          onClose={() => setShowLeagueManagementModal(false)}
          onSelectMatchToScoreboard={applyMatchFromSupabase}
          currentUserEmail={activeUserEmail}
          initialTab={leagueModalInitialTab}
        />}
      </Suspense>
    </div>
  );
}
