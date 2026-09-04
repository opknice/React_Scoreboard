import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { onAuthStateChange, logoutUser, isSuperAdmin } from '../services/supabaseAuthService';
import { useTimer } from '../hooks/useTimer';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import { useAutoMacros } from '../hooks/useAutoMacros';
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
import { translations } from '../constants/translations';
import { getLogoSrc as resolveLogoSrc } from '../utils/logoResolver';
import ReplayControlModals from './ReplayControlModals';
import ScoreboardTimerPanel from './ScoreboardTimerPanel';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useObsReplayBufferFolderRescan } from '../hooks/useObsReplayBufferFolderRescan';
import { useScoreboardModalState } from '../hooks/useScoreboardModalState';
import { useScoreboardMatchState } from '../hooks/useScoreboardMatchState';
import { useAuthAccess } from '../hooks/useAuthAccess';
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
const ScoreboardInfoModals = lazy(() => import('./ScoreboardInfoModals'));
const QuickSetupModal = lazy(() => import('./QuickSetupModal'));
const ObsSetupModal = lazy(() => import('./ObsSetupModal'));
const PresetTimeModal = lazy(() => import('./PresetTimeModal'));
const TeamSelectModal = lazy(() => import('./TeamSelectModal'));
const PenaltyShootoutModal = lazy(() => import('./PenaltyShootoutModal'));
const ScoreboardSettingsModal = lazy(() => import('./ScoreboardSettingsModal'));
import { useSupabaseLeague } from '../hooks/useSupabaseLeague';
import type { Match as SupabaseMatch, Team as SupabaseTeam } from '../config/supabaseClient';
import { parseCropMetadata } from '../types/teamLogo';
import { getFirstUnplayedMatch, isUnplayedMatch } from './league-management/leagueMatchUtils';
import type { SelectableTeam } from './TeamSelectModal';
import ScoreboardHeader from './scoreboard/ScoreboardHeader';
import ScoreboardSetupWizard from './scoreboard/ScoreboardSetupWizard';
import MatchTeamsPanel from './scoreboard/MatchTeamsPanel';
import ScoreboardTimerObsSync from './scoreboard/ScoreboardTimerObsSync';
import LazyLeagueManagementModal from './scoreboard/LazyLeagueManagementModal';
import ScoreboardLazyFallback from './scoreboard/ScoreboardLazyFallback';
import SaveMatchConfirmDialog from './SaveMatchConfirmDialog';

export default function ScoreboardController() {
  const navigate = useNavigate();
  const authAccess = useAuthAccess();
  const [, setTrialClock] = useState(Date.now());
  const timerStore = useTimer();
  const { resetToZero: timerResetToZero, pause: timerPause } = timerStore;
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
  const [teamColorsMemory, setTeamColorsMemory] = useState<Record<string, { color1: string; color2: string }>>(() => {
    const saved = localStorage.getItem('teamColors');
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
    showOBSSetupModal, setShowOBSSetupModal,
  } = useScoreboardModalState();
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
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState<boolean>(false);

  // 🔥 Reset flag when modal opens (cleanup for edge case: F5 after selection)
  useEffect(() => {
    if (showLeagueManagementModal) {
      matchLoadedFromModalRef.current = false;
    }
  }, [showLeagueManagementModal]);

  // 🔥 P2 Fix: Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (clearTeamDataTimerRef.current !== null) {
        window.clearTimeout(clearTeamDataTimerRef.current);
      }
    };
  }, []);

  const [isSavingMatch, setIsSavingMatch] = useState<boolean>(false);

  // Custom Preset Time Input
  const [customTimeMinutes, setCustomTimeMinutes] = useState<number>(0);
  const [customTimeSeconds, setCustomTimeSeconds] = useState<number>(0);

  // Announcement details text
  const [detailsTemplate, setDetailsTemplate] = useState<string>(() => localStorage.getItem('detailsText') || '');

  // Database Viewer States

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
    } catch (error: unknown) {
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

  const activeUserEmail = currentUser?.email || authAccess?.email || '';
  const supabaseLeague = useSupabaseLeague(triggerToast, activeUserEmail);
  const {
    teams: supabaseTeams,
    updateTeam: updateSupabaseTeam,
    uploadTeamLogo,
  } = supabaseLeague;
  const saveTeamLogo = useCallback(async (teamName: string, url: string): Promise<boolean> => {
    const normalizedName = teamName.trim().toLowerCase();
    const cleanUrl = url.trim();
    if (!normalizedName) return false;

    const team = supabaseTeams.find((item) => item.name.trim().toLowerCase() === normalizedName);
    if (!team) {
      triggerToast(`ไม่พบทีม "${teamName}" ในลีก Supabase ปัจจุบัน`, 'warning');
      return false;
    }

    try {
      await updateSupabaseTeam(team.id, { logo_url: cleanUrl });
      return true;
    } catch {
      return false;
    }
  }, [supabaseTeams, triggerToast, updateSupabaseTeam]);
  const {
    activeLeagueId: activeSupabaseLeagueId,
    refreshLeagueDetails,
    selectLeague,
  } = supabaseLeague;
  const [selectedLeagueIdToLoad, setSelectedLeagueIdToLoad] = useState<string>(() => supabaseLeague.activeLeagueId || '');
  const autoLoadedLeagueIdRef = useRef<string | null>(null);
  const matchLoadedFromModalRef = useRef<boolean>(false); // 🔥 Track if user loaded match from modal
  const clearTeamDataTimerRef = useRef<number | null>(null); // 🔥 P2: Debounce timer for clearTeamData

  useEffect(() => {
    setSelectedLeagueIdToLoad(supabaseLeague.activeLeagueId || '');
  }, [supabaseLeague.activeLeagueId]);

  // --- 2-Step Setup Onboarding Gate Checks ---
  const isStep1Complete = videoFolder.isConnected;
  const isStep2Complete = Boolean(supabaseLeague.activeLeagueId);
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
  });

  useAutoObsSourceSync({
    obs,
    teamNameSettings,
    logoSettings,
    scoreSettings,
  });

  const scoreboardStatePayload = useMemo(() => {
    const normalizedNameA = nameA.trim().toLowerCase();
    const normalizedNameB = nameB.trim().toLowerCase();
    const teamA = supabaseLeague.teams.find((team) => team.name.trim().toLowerCase() === normalizedNameA);
    const teamB = supabaseLeague.teams.find((team) => team.name.trim().toLowerCase() === normalizedNameB);

    return {
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
      cropA: parseCropMetadata(teamA?.crop_metadata),
      cropB: parseCropMetadata(teamB?.crop_metadata),
    };
  }, [
    colorA1,
    colorA2,
    colorB1,
    colorB2,
    logoA,
    logoB,
    logoFolderPath,
    nameA,
    nameB,
    scoreA,
    scoreB,
    supabaseLeague.teams,
  ]);

  // Keep the persistent score Browser Source synchronized, including after
  // it is opened or refreshed after the last goal event was sent.
  useEffect(() => {
    broadcastScoreboardState(scoreboardStatePayload);
  }, [scoreboardStatePayload]);

  useScoreboardStateResponder(scoreboardStatePayload);

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

  const addGoal = useCallback((team: 'A' | 'B', source: 'manual' | 'hotkey' | 'macro' = 'manual') => {
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
  }, [colorA1, colorA2, colorB1, colorB2, getLogoSrc, logoA, logoB, nameA, nameB, scoreA, scoreB, setScoreA, setScoreB]);

  const handleAddGoal = useCallback((team: 'A' | 'B') => {
    addGoal(team, 'manual');
  }, [addGoal]);

  // --- Hotkey Callback Handler ---
  const handleHotkeyAction = (action: string) => {
    switch (action) {
      case 'play1':
        timerStore.start1();
        break;
      case 'halfpause':
        timerStore.halfpause();
        break;
      case 'play2':
        timerStore.start2();
        break;
      case 'fullend':
        timerStore.fulltime();
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
        timerStore.pause();
        obs.setText('time_counter', '');
        obs.setText('half_text', '');
        break;
      default:
        break;
    }
  };
  // Sync ref every render so the stable OBS callback always has the latest handler
  hotkeyHandlerRef.current = handleHotkeyAction;

  // --- Team Color Storage Helpers ---
  const saveTeamColors = useCallback((teamName: string, colors: { color1: string; color2: string }) => {
    if (!teamName) return;
    const encoded = encodeURIComponent(teamName);
    setTeamColorsMemory((prev) => {
      const updated = { ...prev, [encoded]: colors };
      localStorage.setItem('teamColors', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getTeamColors = useCallback((teamName: string) => {
    if (!teamName) return { color1: '#ffffff', color2: '#ffffff' };
    const encoded = encodeURIComponent(teamName);
    return teamColorsMemory[encoded] || { color1: '#ffffff', color2: '#ffffff' };
  }, [teamColorsMemory]);

  // --- Apply team from Supabase selection ---
  const applyTeamFromSupabase = (team: SelectableTeam, target: 'A' | 'B') => {
    const primaryColor = team.color_primary || '#ffffff';
    const secondaryColor = team.color_secondary || '#000000';
    const logoSrc = team.logo_url || team.name;

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

  // 🔥 Clear all team data (names, scores, logos, colors) + Sync to OBS
  // P2 Fix: Add debounce to prevent duplicate calls
  const clearTeamData = useCallback(() => {
    // Cancel any pending clear
    if (clearTeamDataTimerRef.current !== null) {
      window.clearTimeout(clearTeamDataTimerRef.current);
    }
    
    // Debounce clear by 50ms
    clearTeamDataTimerRef.current = window.setTimeout(() => {
      setNameA('');
      setNameB('');
      setScoreA(0);
      setScoreB(0);
      setLogoA('');
      setLogoB('');
      setColorA1('#ffffff');
      setColorA2('#000000');
      setColorB1('#ffffff');
      setColorB2('#000000');
      
      // 🔥 P1 Fix: Sync to OBS (Critical - prevent OBS showing stale data)
      obs.setText('name_team_a', '');
      obs.setText('name_team_b', '');
      obs.setImage('logo_team_a', '', logoFolderPath);
      obs.setImage('logo_team_b', '', logoFolderPath);
      obs.setSourceColor('Color_Team_A', '#ffffff');
      obs.setSourceColor('Color_Team_A_2', '#000000');
      obs.setSourceColor('Color_Team_B', '#ffffff');
      obs.setSourceColor('Color_Team_B_2', '#000000');
      
      clearTeamDataTimerRef.current = null;
    }, 50);
  }, [setNameA, setNameB, setScoreA, setScoreB, setLogoA, setLogoB, setColorA1, setColorA2, setColorB1, setColorB2, obs, logoFolderPath]);

  // 🔥 P2 Fix: Stable ref to prevent useEffect re-trigger
  const clearTeamDataRef = useRef(clearTeamData);
  clearTeamDataRef.current = clearTeamData;

  // --- Pending (Unplayed) matches in active league ---
  const pendingMatches = useMemo(() => {
    return supabaseLeague.matches
      .filter(isUnplayedMatch)
      .sort((a, b) => a.match_number - b.match_number);
  }, [supabaseLeague.matches]);

  // --- Check if there are unplayed matches and any matches at all (optimized with useMemo) ---
  const hasUnplayedMatches = useMemo(() => pendingMatches.length > 0, [pendingMatches]);
  const hasAnyMatches = useMemo(() => supabaseLeague.matches.length > 0, [supabaseLeague.matches]);

  // 🔥 Auto-clear team data when no matches or all finished (Hybrid Part A)
  // P1 Fix: Don't clear during loading to prevent flicker
  // P2 Fix: Use ref to prevent unnecessary re-triggers
  useEffect(() => {
    if (!supabaseLeague.detailsLoading && (!hasAnyMatches || !hasUnplayedMatches)) {
      clearTeamDataRef.current();
    }
  }, [hasAnyMatches, hasUnplayedMatches, supabaseLeague.detailsLoading]);

  // --- Load match from Supabase into scoreboard ---
  const applyMatchFromSupabase = useCallback((match: SupabaseMatch, customTeams?: SupabaseTeam[], fromModal = false) => {
    if (!supabaseLeague.activeLeagueId || match.league_id !== supabaseLeague.activeLeagueId) {
      triggerToast('ข้อมูลแมตช์ไม่ตรงกับ League ปัจจุบัน กรุณารีเฟรชข้อมูลลีกก่อน', 'error');
      return;
    }
    if (!isUnplayedMatch(match)) {
      triggerToast(`⚠️ แมตช์ #${match.match_number} (${match.team_a_name} vs ${match.team_b_name}) บันทึกผลแล้ว ไม่สามารถโหลดได้`, 'warning');
      return;
    }

    // 🔥 Track if match was loaded from modal (user action)
    if (fromModal) {
      matchLoadedFromModalRef.current = true;
    }

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
    timerResetToZero();
    setMatchIdInput(match.match_number);

    // Resolve logos from Supabase teams > saved logos > team name
    const resolvedLogoA = teamAObj?.logo_url || teamAName;
    const resolvedLogoB = teamBObj?.logo_url || teamBName;
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

    triggerToast(`(${teamAName} vs ${teamBName}) success`, 'success');
  }, [
    supabaseLeague.activeLeagueId,
    supabaseLeague.teams,
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
    logoFolderPath,
    obs,
    timerResetToZero,
    triggerToast,
  ]);

  // Automatically load the first pending match after both setup steps and the
  // latest league details are ready. The ref prevents duplicate loads caused
  // by React re-renders, Strict Mode, or realtime refreshes.
  useEffect(() => {
    const leagueId = supabaseLeague.activeLeagueId;
    if (!leagueId) {
      autoLoadedLeagueIdRef.current = null;
      return;
    }

    if (
      !isSetupComplete ||
      supabaseLeague.detailsLoading ||
      supabaseLeague.detailsLoadedLeagueId !== leagueId ||
      autoLoadedLeagueIdRef.current === leagueId
    ) {
      return;
    }

    autoLoadedLeagueIdRef.current = leagueId;
    const firstUnplayedMatch = getFirstUnplayedMatch(supabaseLeague.matches);
    if (!firstUnplayedMatch) {
      triggerToast(`ลีก "${supabaseLeague.activeLeague?.name || ''}" ไม่มีคู่แข่งขันที่รอแข่งแล้ว`, 'info');
      return;
    }

    applyMatchFromSupabase(firstUnplayedMatch);
  }, [
    applyMatchFromSupabase,
    isSetupComplete,
    supabaseLeague.activeLeague?.name,
    supabaseLeague.activeLeagueId,
    supabaseLeague.detailsLoadedLeagueId,
    supabaseLeague.detailsLoading,
    supabaseLeague.matches,
    triggerToast,
  ]);

  // --- Navigate matches by index (prev / next) through pending matches only ---
  const handleNavigateMatch = useCallback((direction: 'prev' | 'next') => {
    const unplayedMatches = supabaseLeague.matches
      .filter(isUnplayedMatch)
      .sort((a, b) => a.match_number - b.match_number);
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
  }, [supabaseLeague.matches, matchIdInput, applyMatchFromSupabase, triggerToast]);

  const handleRefreshLeague = useCallback(() => {
    if (!activeSupabaseLeagueId) {
      triggerToast('กรุณาเลือกลีกก่อนรีเฟรชข้อมูล', 'error');
      return;
    }

    // Refresh only the active league details. The current scoreboard match is
    // intentionally preserved; auto-loading is handled when entering a league.
    void refreshLeagueDetails();
  }, [activeSupabaseLeagueId, refreshLeagueDetails, triggerToast]);

  // --- Swap Teams ---
  const swapTeams = useCallback(() => {
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
  }, [
    colorA1,
    colorA2,
    colorB1,
    colorB2,
    logoA,
    logoB,
    logoFolderPath,
    nameA,
    nameB,
    obs,
    scoreA,
    scoreB,
    setColorA1,
    setColorA2,
    setColorB1,
    setColorB2,
    setLogoA,
    setLogoB,
    setNameA,
    setNameB,
    setScoreA,
    setScoreB,
    trans.toastSwapped,
    triggerToast,
  ]);

  // --- Reset Scores ---
  const resetScore = useCallback(() => {
    setScoreA(0);
    setScoreB(0);
    triggerToast(trans.toastScoreReset, 'info');
  }, [setScoreA, setScoreB, trans.toastScoreReset, triggerToast]);

  // --- Save match results to Supabase ---
  const handleSaveMatchToSupabase = async (): Promise<boolean> => {
    const activeLeagueId = supabaseLeague.activeLeagueId;
    if (!activeLeagueId) {
      triggerToast('กรุณาสร้างหรือเลือกลีกในระบบ Supabase ก่อนบันทึกผล', 'error');
      return false;
    }

    // Do not allow a save while the selected league's latest data is still loading.
    if (
      supabaseLeague.detailsLoading
      || supabaseLeague.detailsLoadedLeagueId !== activeLeagueId
    ) {
      triggerToast('กำลังโหลดข้อมูล League ปัจจุบัน กรุณารอสักครู่แล้วลองใหม่', 'warning');
      return false;
    }

    // 1. Try to find a match only inside the currently selected league.
    const currentMatch =
      supabaseLeague.matches.find((m) => m.league_id === activeLeagueId && m.match_number === matchIdInput) ||
      supabaseLeague.matches.find((m) => (
        m.league_id === activeLeagueId
        && m.team_a_name === nameA
        && m.team_b_name === nameB
      ));

    if (currentMatch) {
      try {
        await supabaseLeague.updateMatch(currentMatch.id, {
          score_a: scoreA,
          score_b: scoreB,
          status: 'finished',
        });
        triggerToast(`✓ บันทึกผลแมตช์ #${currentMatch.match_number} (${nameA} ${scoreA} - ${scoreB} ${nameB}) ลง Supabase สำเร็จ!`, 'success');
        return true;
      } catch (err: any) {
        triggerToast(`บันทึกผลไม่สำเร็จ: ${err.message}`, 'error');
        return false;
      }
    }

    // 2. If the active league has no matching row, create a new finished match
    try {
      await supabaseLeague.createMatch({
        league_id: activeLeagueId,
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
      return true;
    } catch (err: unknown) {
      triggerToast(`บันทึกผลไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`, 'error');
      return false;
    }
  };

  // --- Confirm and Save Match (with Modal confirmation) ---
  const confirmAndSaveMatch = async () => {
    setShowConfirmSaveModal(false);
    setIsSavingMatch(true); // เริ่ม loading
    
    try {
      // บันทึกและรอผลลัพธ์
      const success = await handleSaveMatchToSupabase();
      
      // ถ้าบันทึกสำเร็จ → โหลดแมตช์คู่ถัดไป
      if (success) {
        await loadNextPendingMatch();
      }
    } catch {
      triggerToast('เกิดข้อผิดพลาดในการบันทึกผล', 'error');
    } finally {
      setIsSavingMatch(false);
    }
  };

  // --- Load Next Pending Match (after successful save) ---
  const loadNextPendingMatch = useCallback(async () => {
    // Use the fresh server result directly. Reading React state after await
    // would still read this callback's old render snapshot.
    const refreshedDetails = await refreshLeagueDetails();
    if (!refreshedDetails) {
      triggerToast('โหลดข้อมูลลีกล่าสุดไม่สำเร็จ กรุณารีเฟรชแล้วลองอีกครั้ง', 'error');
      return;
    }

    // กรองแมตช์ที่ยังไม่จบและเรียงลำดับ
    // ⚠️ สำคัญ: กรอง matchIdInput ออกด้วย เพราะเป็นแมตช์ที่เพิ่งบันทึกไป (แม้ state จะยังไม่อัพเดท)
    const unplayedMatches = refreshedDetails.matches
      .filter((m) => isUnplayedMatch(m) && m.match_number !== matchIdInput)
      .sort((a, b) => a.match_number - b.match_number);

    // ถ้าไม่มีแมตช์เหลือ → เคลียร์ข้อมูลและซ่อนปุ่ม (Hybrid Part B)
    if (unplayedMatches.length === 0) {
      triggerToast('🎉 บันทึกผลครบทุกคู่แล้ว!', 'success');
      
      // 🔥 เคลียร์ข้อมูลทีมทั้งหมด (Silent)
      clearTeamData();
      setMatchIdInput(0);
      
      return;
    }

    // หาแมตช์คู่ถัดจากปัจจุบัน
    // เนื่องจากเรากรอง matchIdInput ออกแล้ว → แมตช์คู่แรกในรายการคือคู่ถัดไป
    const nextMatch = unplayedMatches[0];

    // โหลดแมตช์นั้นขึ้น Scoreboardโดยใช้ทีมจาก response ชุดเดียวกัน
    if (nextMatch) {
      applyMatchFromSupabase(nextMatch, refreshedDetails.teams);
      triggerToast(`📋 โหลดแมตช์คู่ถัดไป: ${nextMatch.team_a_name} vs ${nextMatch.team_b_name}`, 'info');
    }
  }, [
    applyMatchFromSupabase,
    clearTeamData,
    matchIdInput,
    refreshLeagueDetails,
    triggerToast,
  ]);

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
    const { formattedTime, half } = timerStore.getSnapshot();

    const filled = detailsTemplate
      .replace(/<TeamA>/gi, cleanBr(nameA))
      .replace(/<TeamB>/gi, cleanBr(nameB))
      .replace(/<score_team_a>/gi, String(scoreA))
      .replace(/<score_team_b>/gi, String(scoreB))
      .replace(/<thai_date>/gi, thaiDate)
      .replace(/<time_counter>/gi, formattedTime)
      .replace(/<half_text>/gi, half)
      .replace(/<label1>/gi, cleanBr(label1))
      .replace(/<label2>/gi, cleanBr(label2))
      .replace(/<label3>/gi, cleanBr(label3));

    navigator.clipboard
      .writeText(filled)
      .then(() => triggerToast(trans.toastCopied, 'info'))
      .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
  };

  const handleCopyOverlayUrl = (viewType: string, standaloneFile = '') => {
    const host = window.location.origin;
    const leagueId = supabaseLeague.activeLeagueId;
    if (!leagueId) {
      triggerToast('กรุณาสร้างหรือเลือกลีกในระบบ Supabase ก่อนคัดลอก URL', 'error');
      return;
    }

    const leagueTitle = encodeURIComponent(supabaseLeague.activeLeague?.name || 'League');
    let urlString: string;
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

  const handleVideoFolderConnect = useCallback(async () => {
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
  }, [videoFolder, triggerToast]);

  const handleVideoFolderReset = useCallback(async () => {
    await videoFolder.clearStoredFolder();
    triggerToast('ลืมโฟลเดอร์วิดีโอแล้ว - คลิกปุ่ม Video เพื่อเลือกใหม่', 'info');
  }, [videoFolder, triggerToast]);

  const closePenaltyModal = useCallback(() => {
    setShowPenaltyModal(false);
    obs.getSceneItemId('Main Stream', 'Penalty').then((id) => {
      if (id !== null) obs.setSceneItemEnabled('Main Stream', id, false);
    });
    obs.getSceneItemId('Main Stream', 'Main_events').then((id) => {
      if (id !== null) obs.setSceneItemEnabled('Main Stream', id, true);
    });
  }, [obs, setShowPenaltyModal]);

  const handleOpenPenaltyShootout = useCallback(async () => {
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
  }, [obs, setShowPenaltyModal]);

  const handleHideTimer = useCallback(() => {
    timerPause();
    obs.setText('time_counter', '');
    obs.setText('half_text', '');
    broadcastScoreboardButton('pause_timer');
  }, [timerPause, obs]);

  const handleOpenPenaltyShootoutCallback = useCallback(() => {
    void handleOpenPenaltyShootout();
  }, [handleOpenPenaltyShootout]);

  const handleOpenPresetTime = useCallback(() => {
    setShowPresetTimeModal(true);
  }, [setShowPresetTimeModal]);

  const handleOpenVarReplay = useCallback(() => {
    broadcastScoreboardButton('var_replay');
    setShowVarReplayV2Modal(true);
  }, [setShowVarReplayV2Modal]);

  const handleOpenInstantReplay = useCallback(() => {
    broadcastScoreboardButton('instant_replay');
    setShowInstantReplayModal(true);
  }, [setShowInstantReplayModal]);

  const handleCloseVarReplay = useCallback(() => {
    setShowVarReplayV2Modal(false);
  }, [setShowVarReplayV2Modal]);

  const handleCloseInstantReplay = useCallback(() => {
    setShowInstantReplayModal(false);
  }, [setShowInstantReplayModal]);

  const handleNavigateWhitelist = useCallback(() => {
    navigate('/admin/whitelist');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logoutUser();
  }, []);

  const handleSelectLeagueWizard = useCallback((newId: string) => {
    setSelectedLeagueIdToLoad(newId);
    selectLeague(newId);
  }, [selectLeague]);

  const handleOpenLeagueManagement = useCallback((tab: 'league' | 'teams' | 'matches') => {
    setLeagueModalInitialTab(tab);
    setShowLeagueManagementModal(true);
  }, []);

  const handlePrefetchLeagueManagement = useCallback(() => {
    void import('./LeagueManagementModal');
  }, []);

  const handleMinusScore = useCallback((team: 'A' | 'B') => {
    if (team === 'A') {
      setScoreA((prev) => Math.max(0, prev - 1));
    } else {
      setScoreB((prev) => Math.max(0, prev - 1));
    }
  }, [setScoreA, setScoreB]);

  const handleColorChange = useCallback((team: 'A' | 'B', which: 1 | 2, color: string) => {
    if (team === 'A') {
      if (which === 1) {
        setColorA1(color);
        obs.setSourceColor('Color_Team_A', color);
        saveTeamColors(nameA, { color1: color, color2: colorA2 });
      } else {
        setColorA2(color);
        obs.setSourceColor('Color_Team_A_2', color);
        saveTeamColors(nameA, { color1: colorA1, color2: color });
      }
    } else {
      if (which === 1) {
        setColorB1(color);
        obs.setSourceColor('Color_Team_B', color);
        saveTeamColors(nameB, { color1: color, color2: colorB2 });
      } else {
        setColorB2(color);
        obs.setSourceColor('Color_Team_B_2', color);
        saveTeamColors(nameB, { color1: colorB1, color2: color });
      }
    }
  }, [colorA1, colorA2, colorB1, colorB2, nameA, nameB, obs, saveTeamColors, setColorA1, setColorA2, setColorB1, setColorB2]);

  const handleQuickColor = useCallback((team: 'A' | 'B', color: string) => {
    if (team === 'A') {
      setColorA1(color);
      obs.setSourceColor('Color_Team_A', color);
      saveTeamColors(nameA, { color1: color, color2: colorA2 });
    } else {
      setColorB1(color);
      obs.setSourceColor('Color_Team_B', color);
      saveTeamColors(nameB, { color1: color, color2: colorB2 });
    }
  }, [colorA2, colorB2, nameA, nameB, obs, saveTeamColors, setColorA1, setColorB1]);

  const handleLogoClick = useCallback(() => {
    setShowLeagueManagementModal(true);
  }, []);

  const handleSelectMatchFromLeague = useCallback((match: SupabaseMatch) => {
    applyMatchFromSupabase(match, undefined, true);
  }, [applyMatchFromSupabase]);

  const handleCloseLeagueManagement = useCallback(() => {
    // Capture the current pending match before closing. A manual selection
    // must never be overwritten by the automatic first-pending selection.
    const shouldAutoLoad = !matchLoadedFromModalRef.current;
    const firstPendingMatch = pendingMatches[0] ?? null;

    setShowLeagueManagementModal(false);

    if (!shouldAutoLoad) {
      if (import.meta.env.DEV) {
        console.log('[Modal onClose] User loaded match from modal, skip auto-load');
      }
      matchLoadedFromModalRef.current = false;
      return;
    }

    if (firstPendingMatch && supabaseLeague.activeLeagueId) {
      window.setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log('[Modal onClose] Auto-loading first pending match:', firstPendingMatch.match_number);
        }
        applyMatchFromSupabase(firstPendingMatch);
      }, 100);
    } else if (import.meta.env.DEV) {
      console.log('[Modal onClose] No pending matches to auto-load');
    }
  }, [applyMatchFromSupabase, pendingMatches, supabaseLeague.activeLeagueId]);

  const handleStartEditName = useCallback((team: 'A' | 'B') => {
    if (team === 'A') {
      setEditNameAVal(nameA);
      setIsEditingA(true);
    } else {
      setEditNameBVal(nameB);
      setIsEditingB(true);
    }
  }, [nameA, nameB, setEditNameAVal, setEditNameBVal, setIsEditingA, setIsEditingB]);

  const handleEditNameValChange = useCallback((team: 'A' | 'B', val: string) => {
    if (team === 'A') {
      setEditNameAVal(val);
    } else {
      setEditNameBVal(val);
    }
  }, [setEditNameAVal, setEditNameBVal]);

  const handleSaveEditName = useCallback((team: 'A' | 'B') => {
    if (team === 'A') {
      setNameA(editNameAVal);
      setIsEditingA(false);
      obs.setText('name_team_a', editNameAVal.replace(/\//g, '\n'));
    } else {
      setNameB(editNameBVal);
      setIsEditingB(false);
      obs.setText('name_team_b', editNameBVal.replace(/\//g, '\n'));
    }
  }, [editNameAVal, editNameBVal, obs, setNameA, setNameB, setIsEditingA, setIsEditingB]);

  const handleOpenTeamSelect = useCallback((target: 'A' | 'B') => {
    setTeamSelectTarget(target);
    setTeamSelectSearch('');
    setShowTeamSelectModal(true);
  }, [setShowTeamSelectModal]);

  return (
    <div className="container">
      <ScoreboardTimerObsSync obs={obs} timer={timerStore} />

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
      <ScoreboardHeader
        videoFolder={videoFolder}
        onConnectVideoFolder={handleVideoFolderConnect}
        onResetVideoFolder={handleVideoFolderReset}
        currentUser={currentUser}
        authAccess={authAccess}
        isSuperAdminUser={isSuperAdmin(currentUser?.email)}
        onNavigateWhitelist={handleNavigateWhitelist}
        onLogout={handleLogout}
      />

      {/* 2-Step Setup Onboarding Wizard Gate */}
      {!isSetupComplete ? (
        <ScoreboardSetupWizard
          isStep1Complete={isStep1Complete}
          isStep2Complete={isStep2Complete}
          videoFolderConnecting={videoFolder.isConnecting}
          onConnectVideoFolder={handleVideoFolderConnect}
          leagues={supabaseLeague.leagues}
          activeLeagueId={supabaseLeague.activeLeagueId || ''}
          activeLeague={supabaseLeague.activeLeague}
          teamCount={supabaseLeague.teams.length}
          matchCount={supabaseLeague.matches.length}
          onSelectLeague={handleSelectLeagueWizard}
          onOpenLeagueManagement={handleOpenLeagueManagement}
        />
      ) : (
        <>
          {/* Controls Bar */}
          <div className="card" style={{ padding: '8px 12px' }}>
            <div className="row space-between" style={{ gap: '8px', marginBottom: 0 }}>
              <div className="row" style={{ marginBottom: 0, gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* ปุ่มจัดการลีก - เก็บไว้ที่เดิม */}
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowLeagueManagementModal(true)}
                  onFocus={handlePrefetchLeagueManagement}
                  onPointerEnter={handlePrefetchLeagueManagement}
                  title="จัดการข้อมูลลีก รายชื่อทีม และตารางการแข่งขันผ่าน Supabase"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', fontWeight: 600 }}
                >
                  <i className="fas fa-trophy" style={{ fontSize: '0.9rem', color: '#f59e0b' }}></i>
                  <span>จัดการลีก</span>
                </button>

              </div>

              <div className="row" style={{ marginBottom: 0, gap: '4px', alignItems: 'center' }}>
                {/* League Selector Dropdown (ย้ายมาจาก Header) */}
                <select
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.82rem',
                    background: '#0f172a',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    minWidth: '100px',
                    maxWidth: '150px',
                    fontWeight: 600
                  }}
                  value={supabaseLeague.activeLeagueId || selectedLeagueIdToLoad}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedLeagueIdToLoad(newId);
                    selectLeague(newId);
                  }}
                  title="เลือกลีก"
                >
                  <option value="">-- โปรดเลือกลีก --</option>
                  {supabaseLeague.leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} {league.season ? `(${league.season})` : ''}
                    </option>
                  ))}
                </select>

                {/* Refresh league data button (ย้ายมาจาก Header) */}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={handleRefreshLeague}
                  disabled={!supabaseLeague.activeLeagueId || supabaseLeague.loading || supabaseLeague.detailsLoading || supabaseLeague.refreshing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#059669',
                    borderColor: '#059669',
                    fontWeight: 600,
                    cursor: supabaseLeague.activeLeagueId && !supabaseLeague.detailsLoading ? 'pointer' : 'not-allowed',
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                  }}
                  title="Refresh.."
                >
                  <i className={supabaseLeague.loading || supabaseLeague.detailsLoading || supabaseLeague.refreshing ? "fas fa-spinner fa-spin" : "fas fa-sync-alt"}></i>
                  <span>{supabaseLeague.loading || supabaseLeague.detailsLoading || supabaseLeague.refreshing ? '' : ''}</span>
                </button>

                <button
                  onClick={() => handleNavigateMatch('prev')}
                  style={{ padding: '3px 8px', background: '#333', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                  title="แมตช์ก่อนหน้า"
                >
                  &lt;
                </button>
                
                {/* Matches Dropdown */}
                {supabaseLeague.matches.length > 0 && pendingMatches.length > 0 ? (
                  <select
                    style={{
                      padding: '5px 8px',
                      fontSize: '0.82rem',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      minWidth: '100px',
                      maxWidth: '150px',
                      flex: '1'
                    }}
                    value={pendingMatches.some((m) => m.match_number === matchIdInput) ? matchIdInput : ''}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      if (num) {
                        setMatchIdInput(num);
                        const matchObj = pendingMatches.find((m) => m.match_number === num);
                        if (matchObj) {
                          matchLoadedFromModalRef.current = true; // 🔥 Track dropdown selection
                          applyMatchFromSupabase(matchObj);
                        }
                      }
                    }}
                    title="เลือกคู่แข่งขัน"
                  >
                    <option value="" disabled>-- เลือกคู่แข่งขัน --</option>
                    {pendingMatches.map((m) => (
                      <option key={m.id} value={m.match_number}>
                        {m.team_a_name} vs {m.team_b_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      fontStyle: 'italic',
                      padding: '5px 8px'
                    }}
                  >
                    {supabaseLeague.matches.length > 0 ? 'บันทึกผลครบทุกคู่แล้ว ✓' : 'ไม่มีคู่แข่งขัน'}
                  </span>
                )}
                
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

          {/* Team score and editor panel (Memoized) */}
          <MatchTeamsPanel
            scoreA={scoreA}
            scoreB={scoreB}
            nameA={nameA}
            nameB={nameB}
            colorA1={colorA1}
            colorA2={colorA2}
            colorB1={colorB1}
            colorB2={colorB2}
            logoA={logoA}
            logoB={logoB}
            isEditingA={isEditingA}
            isEditingB={isEditingB}
            editNameAVal={editNameAVal}
            editNameBVal={editNameBVal}
            hasSupabaseTeams={supabaseLeague.teams.length > 0}
            resetLabel={trans.reset}
            onAddGoal={handleAddGoal}
            onMinusScore={handleMinusScore}
            onColorChange={handleColorChange}
            onQuickColor={handleQuickColor}
            onLogoClick={handleLogoClick}
            onStartEditName={handleStartEditName}
            onEditNameValChange={handleEditNameValChange}
            onSaveEditName={handleSaveEditName}
            onOpenTeamSelect={handleOpenTeamSelect}
            onSwapTeams={swapTeams}
            onResetScore={resetScore}
            getLogoSrc={getLogoSrc}
          />

          <ScoreboardTimerPanel
            timer={timerStore}
            onOpenPresetTime={handleOpenPresetTime}
            onHideTime={handleHideTimer}
            onPenaltyShootout={handleOpenPenaltyShootoutCallback}
            onOpenVarReplay={handleOpenVarReplay}
            onOpenInstantReplay={handleOpenInstantReplay}
          />

          {/* Match save triggers dynamically */}
          {/* Match save triggers dynamically (Supabase) */}
          <div className="card" style={{ padding: '14px 18px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px' }}>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {!supabaseLeague.activeLeague ? (
                // ไม่มีลีก → แสดงปุ่มเลือกลีก
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowLeagueManagementModal(true)}
                  onFocus={handlePrefetchLeagueManagement}
                  onPointerEnter={handlePrefetchLeagueManagement}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', padding: '8px 16px', fontWeight: 600 }}
                >
                  <i className="fas fa-trophy"></i> เลือกลีก Supabase เพื่อเปิดใช้ปุ่มบันทึกผลบอล
                </button>
              ) : !hasAnyMatches || !hasUnplayedMatches ? (
                // ไม่มีคู่แข่งขัน หรือ บันทึกครบทุกคู่แล้ว → ซ่อนปุ่ม (ไม่แสดงอะไร)
                null
              ) : !nameA || !nameB ? (
                // มีคู่รอแข่ง แต่ไม่มีชื่อทีม → แสดงข้อความ
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                  กรุณาเลือกคู่แข่งขันเพื่อบันทึกผล
                </span>
              ) : (
                // มีทุกอย่างพร้อม → แสดงปุ่มบันทึกผล
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowConfirmSaveModal(true)}
                  disabled={isSavingMatch}
                  style={{ 
                    background: isSavingMatch 
                      ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' 
                      : 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
                    border: 'none', 
                    padding: '10px 22px', 
                    fontSize: '0.95rem', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    boxShadow: isSavingMatch 
                      ? '0 4px 14px rgba(107, 114, 128, 0.4)' 
                      : '0 4px 14px rgba(5, 150, 105, 0.4)', 
                    cursor: isSavingMatch ? 'not-allowed' : 'pointer',
                    opacity: isSavingMatch ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSavingMatch ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.1rem', color: '#d1d5db' }}></i>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle" style={{ fontSize: '1.1rem', color: '#6ee7b7' }}></i>
                      <span 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                        title={`💾 บันทึกผล (${nameA})  ${scoreA} - ${scoreB}  (${nameB})`}
                      >
                        <span>💾 บันทึกผล</span>
                        <span>({nameA}) </span>
                        <span style={{ fontWeight: 700 }}>{scoreA} - {scoreB}</span>
                        <span> ({nameB})</span>
                      </span>
                    </>
                  )}
                </button>
              )}

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

      <Suspense fallback={<ScoreboardLazyFallback />}>
        {showSettingsModal && <ScoreboardSettingsModal
          isOpen={showSettingsModal}
          trans={trans}
          detailsTemplate={detailsTemplate}
          nameA={nameA}
          nameB={nameB}
          scoreA={scoreA}
          scoreB={scoreB}
          timer={timerStore}
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
                {trans.logoPathDesc || 'อัปโหลดโลโก้ผ่าน Supabase Storage หรือใส่ URL โลโก้ของทีม مباشرة'}
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
                      placeholder="https://..."
                      value={logoA}
                      onChange={(e) => {
                        setLogoA(e.target.value);
                      }}
                      onBlur={() => { void saveTeamLogo(nameA, logoA); }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setLogoA(text);
                            const saved = await saveTeamLogo(nameA, text);
                            if (saved) triggerToast('วาง URL ให้ Team A และบันทึก Supabase เรียบร้อย', 'success');
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
                      placeholder="https://..."
                      value={logoB}
                      onChange={(e) => {
                        setLogoB(e.target.value);
                      }}
                      onBlur={() => { void saveTeamLogo(nameB, logoB); }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setLogoB(text);
                            const saved = await saveTeamLogo(nameB, text);
                            if (saved) triggerToast('วาง URL ให้ Team B และบันทึก Supabase เรียบร้อย', 'success');
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
                uploadLogo={uploadTeamLogo}
                onUploadSuccess={async (fileName, url, targetTeam) => {
                  triggerToast(`✅ อัปโหลด ${fileName} สำเร็จ!`, 'success');
                  if (targetTeam === 'B') {
                    const saved = await saveTeamLogo(nameB, url);
                    if (!saved) return;
                    setLogoB(url);
                    obs.setImage('logo_team_b', url, logoFolderPath);
                    triggerToast(`ตั้งค่าโลโก้ Team B (${nameB}) ใน Supabase แล้ว`, 'info');
                  } else {
                    if (targetTeam === 'none') return;
                    const saved = await saveTeamLogo(nameA, url);
                    if (!saved) return;
                    setLogoA(url);
                    obs.setImage('logo_team_a', url, logoFolderPath);
                    triggerToast(`ตั้งค่าโลโก้ Team A (${nameA}) ใน Supabase แล้ว`, 'info');
                  }
                }}
              />
            </div>
          </div>
        )}

        {showPresetTimeModal && <PresetTimeModal
          isOpen={showPresetTimeModal}
          minutes={customTimeMinutes}
          seconds={customTimeSeconds}
          title={trans.timeSettingsTitle || 'ปรับแต่งเวลาเริ่มต้นครึ่งหลัง'}
          closeLabel={trans.close}
          onMinutesChange={setCustomTimeMinutes}
          onSecondsChange={setCustomTimeSeconds}
          onSetPreset={(minutes) => {
            timerStore.setCountdownStartTime(minutes * 60);
            setShowPresetTimeModal(false);
            triggerToast(`ตั้งเวลาครึ่งหลังเป็น ${minutes} นาทีแล้ว`, 'success');
          }}
          onSetCountdown={(totalSeconds, applyNow) => {
            timerStore.setCountdownStartTime(totalSeconds);
            if (applyNow) timerStore.setTimerValue(totalSeconds);
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
          teams={supabaseLeague.teams}
          onUpdateTeam={supabaseLeague.updateTeam}
          tickerSpeed={tickerSpeed}
          closeLabel={trans.close}
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
          onClose={() => setShowQuickSetupModal(false)}
        />}

        {showOBSSetupModal && <ObsSetupModal
          isOpen={showOBSSetupModal}
          closeLabel={trans.close}
          onDownload={handleDownloadTemplate}
          onClose={() => setShowOBSSetupModal(false)}
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
          onCloseVarReplayV2={handleCloseVarReplay}
          onCloseInstantReplay={handleCloseInstantReplay}
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

        {showLeagueManagementModal && <LazyLeagueManagementModal
          isOpen={showLeagueManagementModal}
          onClose={handleCloseLeagueManagement}
          onSelectMatchToScoreboard={handleSelectMatchFromLeague}
          currentUserEmail={activeUserEmail}
          initialTab={leagueModalInitialTab}
          leagueState={supabaseLeague}
        />}

        <SaveMatchConfirmDialog
          isOpen={showConfirmSaveModal}
          teamAName={nameA}
          teamBName={nameB}
          scoreA={scoreA}
          scoreB={scoreB}
          onConfirm={confirmAndSaveMatch}
          onClose={() => setShowConfirmSaveModal(false)}
        />
      </Suspense>
    </div>
  );
}
