import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getDatabase, ref, push } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth, logoutUser, isSuperAdmin } from '../config/firebaseAuth';
import { useTimer } from '../hooks/useTimer';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import { useAutoMacros } from '../hooks/useAutoMacros';
import { useScoreboardFirebase } from '../hooks/useScoreboardFirebase';
import { useScoreboardObsConnection } from '../hooks/useScoreboardObsConnection';
import {
  broadcastScoreboardButton,
  useModalControlChannel,
  useScoreboardKeyboardBroadcast,
} from '../hooks/useScoreboardChannels';
import { useScoreboardObsSync } from '../hooks/useScoreboardObsSync';
import { useScoreboardDatabase } from '../hooks/useScoreboardDatabase';
import { translations } from '../constants/translations';
import {
  parseFirebaseSaveTargets,
  normalizeColumnName,
  isFirebaseConfigSheetName,
  inferExcelMapping,
  loadTeamSheetWithColors
} from '../utils/excelParser';
import type { FirebaseSaveTarget, TeamColorRow } from '../utils/excelParser';
import { getLogoSrc as resolveLogoSrc } from '../utils/logoResolver';
import AutoMacrosPanel from './AutoMacrosPanel';
import LogoUploader from './LogoUploader';
import TeamLogosManagerModal from './TeamLogosManagerModal';
import DatabaseMatchesModal from './DatabaseMatchesModal';
import EditDatabaseMatchModal from './EditDatabaseMatchModal';
import ScoreboardInfoModals from './ScoreboardInfoModals';
import QuickSetupModal from './QuickSetupModal';
import ObsSetupModal from './ObsSetupModal';
import PresetTimeModal from './PresetTimeModal';
import TeamSelectModal from './TeamSelectModal';
import ReplayControlModals from './ReplayControlModals';
import PenaltyShootoutModal from './PenaltyShootoutModal';
import ScoreboardSettingsModal from './ScoreboardSettingsModal';
import ExcelUrlModal from './ExcelUrlModal';
import ScoreboardTimerPanel from './ScoreboardTimerPanel';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useObsReplayBufferFolderRescan } from '../hooks/useObsReplayBufferFolderRescan';
import { useScoreboardModalState } from '../hooks/useScoreboardModalState';
import { useScoreboardMatchState } from '../hooks/useScoreboardMatchState';

export interface SavedExcelUrl {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

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
  const [leagueName, setLeagueName] = useState<string>('Football Scoreboard Controller');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [excelUrlInput, setExcelUrlInput] = useState<string>(() => localStorage.getItem('lastExcelUrl') || '');
  const [excelUrlNameInput, setExcelUrlNameInput] = useState<string>('');
  const [savedExcelUrls, setSavedExcelUrls] = useState<SavedExcelUrl[]>(() => {
    try {
      const saved = localStorage.getItem('savedExcelUrls');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const excelRequestRef = useRef(0);
  const excelFetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    excelRequestRef.current += 1;
    excelFetchAbortRef.current?.abort();
  }, []);
  const [firebaseTargets, setFirebaseTargets] = useState<FirebaseSaveTarget[]>([]);
  const [teamSheetData, setTeamSheetData] = useState<TeamColorRow[]>([]);
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
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (usr) => {
        setCurrentUser(usr);
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

  const getTeamLogo = (teamName: string) => {
    if (!teamName) return '';
    const cleanKey = teamName.trim().toLowerCase();
    return teamLogosMemory[cleanKey] || '';
  };

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
  const [teamSelectTarget, setTeamSelectTarget] = useState<'A' | 'B'>('A');
  const [teamSelectSearch, setTeamSelectSearch] = useState<string>('');

  // Custom Preset Time Input
  const [customTimeMinutes, setCustomTimeMinutes] = useState<number>(0);
  const [customTimeSeconds, setCustomTimeSeconds] = useState<number>(0);

  // Announcement details text
  const [detailsTemplate, setDetailsTemplate] = useState<string>(() => localStorage.getItem('detailsText') || '');

  // Database Viewer States
  const [selectedQuickLeagueId, setSelectedQuickLeagueId] = useState<string>('');

  // Toast States
  const [toasts, setToasts] = useState<{ id: string; message: string; type: string }[]>([]);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trans = translations[currentLang] || translations.en;

  const { activeDb, getOrCreateFirebaseApp } = useScoreboardFirebase({
    targets: firebaseTargets,
    selectedTargetId: selectedQuickLeagueId,
    onTeamsUpdated: () => setTeamsCacheVersion((previous) => previous + 1),
  });

  const getMappedValue = useCallback((row: any[], fieldKey: string, currentMapping = excelMapping, currentHeaders = excelData[0] || []) => {
    const columnName = currentMapping[fieldKey];
    if (!columnName) return '';
    const idx = currentHeaders.indexOf(columnName);
    return idx >= 0 ? row[idx] ?? '' : '';
  }, [excelMapping, excelData]);

  const getMatchIdValue = useCallback((row: any[], currentMapping = excelMapping, currentHeaders = excelData[0] || []) => {
    const mapped = getMappedValue(row, 'matchId', currentMapping, currentHeaders);
    if (mapped !== '') return mapped;
    return row[0] ?? '';
  }, [getMappedValue, excelMapping, excelData]);

  // Compute list of unique team names from Excel and Team Sheet safely
  const allUniqueTeams = useMemo(() => {
    if (!excelData.length && !teamSheetData.length) return [];
    const headers = excelData[0] || [];
    const mapping = Object.keys(excelMapping).length ? excelMapping : inferExcelMapping(headers);

    const matchTeams = excelData.slice(1).flatMap((row) => [
      getMappedValue(row, 'teamA', mapping, headers),
      getMappedValue(row, 'teamB', mapping, headers)
    ]);

    const sheetTeams = teamSheetData.map((t) => t.team);

    return Array.from(new Set([...sheetTeams, ...matchTeams]))
      .map((name) => String(name || '').trim())
      .filter((name) => name.length > 0);
  }, [excelData, excelMapping, teamSheetData, getMappedValue]);

  // --- Toast Function ---
  const triggerToast = (message: string, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const database = useScoreboardDatabase({
    activeDb,
    targets: firebaseTargets,
    selectedTargetId: selectedQuickLeagueId,
    notify: triggerToast,
  });

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
        setScoreA((prev) => prev + 1);
        break;
      case 'scoreAminus':
        setScoreA((prev) => Math.max(0, prev - 1));
        break;
      case 'scoreBplus':
        setScoreB((prev) => prev + 1);
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

  const getTeamColors = (teamName: string) => {
    if (!teamName) return { color1: '#ffffff', color2: '#ffffff' };
    const encoded = encodeURIComponent(teamName);
    return teamColorsMemory[encoded] || { color1: '#ffffff', color2: '#ffffff' };
  };

  const getTeamColorsFromSheet = (teamName: string) => {
    if (!teamSheetData.length || !teamName) return null;
    const row = teamSheetData.find(
      (r) => normalizeColumnName(r.team) === normalizeColumnName(teamName)
    );
    if (!row) return null;
    return {
      color1: row.color1 || '#ffffff',
      color2: row.color2 || '#ffffff'
    };
  };

  // --- Apply team from Team Sheet selection ---
  const applyTeamFromSheet = (teamName: string, target: 'A' | 'B') => {
    const sheetColors = getTeamColorsFromSheet(teamName) || getTeamColors(teamName);
    const savedCloudLogo = getTeamLogo(teamName);
    const logoFile = savedCloudLogo || `${teamName}.png`;

    if (target === 'A') {
      setNameA(teamName);
      setColorA1(sheetColors.color1);
      setColorA2(sheetColors.color2);
      setLogoA(logoFile);
      obs.setText('name_team_a', teamName.replace(/\//g, '\n'));
      obs.setImage('logo_team_a', logoFile, logoFolderPath);
      obs.setSourceColor('Color_Team_A', sheetColors.color1);
      obs.setSourceColor('Color_Team_A_2', sheetColors.color2);
    } else {
      setNameB(teamName);
      setColorB1(sheetColors.color1);
      setColorB2(sheetColors.color2);
      setLogoB(logoFile);
      obs.setText('name_team_b', teamName.replace(/\//g, '\n'));
      obs.setImage('logo_team_b', logoFile, logoFolderPath);
      obs.setSourceColor('Color_Team_B', sheetColors.color1);
      obs.setSourceColor('Color_Team_B_2', sheetColors.color2);
    }
    setShowTeamSelectModal(false);
    setTeamSelectSearch('');
    triggerToast(`เลือกทีม ${teamName} แล้ว`, 'success');
  };

  // --- Logo Preview Logic ---
  const getLogoSrc = (logoName: string, teamName?: string) => {
    return resolveLogoSrc(logoName, teamName, logoFolderPath);
  };

  // --- Excel Loading & Parsing Logic ---
  const processExcelBuffer = async (
    buffer: ArrayBuffer,
    fileName: string,
    requestId = excelRequestRef.current,
  ) => {
    try {
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array' });

      const preferredNames = ['matching', 'matches', 'match'];
      const sheetName =
        workbook.SheetNames.find((name) => preferredNames.includes(normalizeColumnName(name))) ||
        workbook.SheetNames.find((name) => !isFirebaseConfigSheetName(name)) ||
        workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
      const headers = rows[0] || [];
      const mapping = inferExcelMapping(headers);
      const targets = parseFirebaseSaveTargets(workbook);

      const colors = await loadTeamSheetWithColors(buffer);
      if (requestId !== excelRequestRef.current) return;

      // Commit all parsed data to state
      setExcelData(rows);
      setExcelMapping(mapping);
      setTeamSheetData(colors);
      setFirebaseTargets(targets);
      if (targets.length > 0) {
        setSelectedQuickLeagueId(targets[0].id);
      }

      const lName = targets.length > 0 ? targets[0].name : fileName.replace(/\.[^/.]+$/, '');
      setLeagueName(lName);
      document.title = `${lName} - Scoreboard Controller`;

      // Auto-load match ID 1 with fresh data (rows, mapping, colors all available)
      applyMatch(1, rows, colors);
      triggerToast(`โหลดข้อมูล ${lName} เรียบร้อยแล้ว`, 'success');
    } catch (err: any) {
      if (requestId !== excelRequestRef.current) return;
      triggerToast(err.message || 'Error parsing Excel file', 'error');
      throw err;
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const requestId = ++excelRequestRef.current;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer && requestId === excelRequestRef.current) {
        processExcelBuffer(buffer, file.name, requestId).catch(() => {});
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper to format Google Sheets URL if needed
  const formatExcelUrl = (urlStr: string): string => {
    let cleanUrl = urlStr.trim();
    if (cleanUrl.includes('docs.google.com/spreadsheets/d/')) {
      const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        cleanUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
      }
    }
    return cleanUrl;
  };

  const handleExcelFromUrl = async (urlToFetch = excelUrlInput) => {
    if (!urlToFetch.trim()) {
      triggerToast('กรุณากรอก URL ลิงก์ไฟล์ Excel หรือ Google Sheets', 'error');
      return;
    }

    const requestId = ++excelRequestRef.current;
    excelFetchAbortRef.current?.abort();
    const abortController = new AbortController();
    excelFetchAbortRef.current = abortController;
    setIsLoadingUrl(true);
    try {
      const formattedUrl = formatExcelUrl(urlToFetch);
      const response = await fetch(formattedUrl, { signal: abortController.signal });
      if (!response.ok) {
        throw new Error(`ไม่สามารถดาวน์โหลดไฟล์ได้ (HTTP ${response.status}) กรุณาเช็คสิทธิ์ไฟล์`);
      }
      const buffer = await response.arrayBuffer();

      let fileName = 'Excel_URL.xlsx';
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) fileName = match[1];
      } else {
        try {
          const urlPath = new URL(formattedUrl).pathname;
          const lastSegment = urlPath.split('/').pop();
          if (lastSegment && lastSegment.includes('.')) fileName = lastSegment;
        } catch {
          // Fallback
        }
      }

      await processExcelBuffer(buffer, fileName, requestId);
      if (requestId !== excelRequestRef.current) return;
      localStorage.setItem('lastExcelUrl', urlToFetch.trim());
      setShowUrlModal(false);
    } catch (err: any) {
      if (abortController.signal.aborted || requestId !== excelRequestRef.current) return;
      console.error('Error fetching Excel from URL:', err);
      triggerToast(err.message || 'เกิดข้อผิดพลาดในการโหลดไฟล์จาก URL (อาจติด CORS หรือสิทธิ์ไฟล์)', 'error');
    } finally {
      if (excelFetchAbortRef.current === abortController) {
        excelFetchAbortRef.current = null;
        setIsLoadingUrl(false);
      }
    }
  };

  // --- Saved URL Presets Logic ---
  const handleSaveUrlPreset = () => {
    const url = excelUrlInput.trim();
    if (!url) {
      triggerToast('กรุณากรอก URL ลิงก์ไฟล์ก่อนบันทึก', 'error');
      return;
    }
    const name = excelUrlNameInput.trim() || `Excel Link (${new Date().toLocaleDateString('th-TH')})`;

    const newPreset: SavedExcelUrl = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name,
      url,
      createdAt: Date.now()
    };

    const updatedList = [newPreset, ...savedExcelUrls.filter((item) => item.url !== url)];
    setSavedExcelUrls(updatedList);
    localStorage.setItem('savedExcelUrls', JSON.stringify(updatedList));
    setExcelUrlNameInput('');
    triggerToast(`บันทึก "${name}" เรียบร้อยแล้ว`, 'success');
  };

  const handleDeleteUrlPreset = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updatedList = savedExcelUrls.filter((item) => item.id !== id);
    setSavedExcelUrls(updatedList);
    localStorage.setItem('savedExcelUrls', JSON.stringify(updatedList));
    triggerToast('ลบรายการบันทึกเรียบร้อยแล้ว', 'info');
  };

  const handleSelectUrlPreset = (preset: SavedExcelUrl) => {
    setExcelUrlInput(preset.url);
    if (!excelUrlNameInput) {
      setExcelUrlNameInput(preset.name);
    }
    handleExcelFromUrl(preset.url);
  };

  // --- Load match data by ID ---
  // freshTeamSheet: pass colors directly when calling right after Excel load (before state updates)
  const applyMatch = (matchId = matchIdInput, customRows = excelData, freshTeamSheet?: TeamColorRow[]) => {
    if (!customRows.length) {
      triggerToast(trans.toastLoadFileFirst, 'error');
      return;
    }

    const headers = customRows[0] || [];
    const mapping = Object.keys(excelMapping).length ? excelMapping : inferExcelMapping(headers);

    const matchRow = customRows.slice(1).find((r) => {
      const idVal = parseInt(getMatchIdValue(r, mapping, headers), 10);
      return idVal === matchId;
    });

    if (!matchRow) {
      triggerToast(`${trans.toastMatchNotFound} ${matchId}`, 'error');
      return;
    }

    const teamAName = getMappedValue(matchRow, 'teamA', mapping, headers) || trans.teamA;
    const teamBName = getMappedValue(matchRow, 'teamB', mapping, headers) || trans.teamB;

    setNameA(teamAName);
    setNameB(teamBName);
    setScoreA(0);
    setScoreB(0);
    timerHook.resetToZero();

    // Logos - Fallback to saved team logo or team name so getLogoSrc resolves Cloud/Local logo immediately
    const logoAFile = getMappedValue(matchRow, 'logoA', mapping, headers);
    const logoBFile = getMappedValue(matchRow, 'logoB', mapping, headers);
    const resolvedLogoA = logoAFile || getTeamLogo(teamAName) || teamAName;
    const resolvedLogoB = logoBFile || getTeamLogo(teamBName) || teamBName;
    setLogoA(resolvedLogoA);
    setLogoB(resolvedLogoB);

    // Apply colors: freshTeamSheet (on first load) > state teamSheetData > saved colors > default
    const teamSheet = freshTeamSheet ?? teamSheetData;
    const getSheetColors = (name: string) => {
      if (!teamSheet.length || !name) return null;
      const row = teamSheet.find((r) => normalizeColumnName(r.team) === normalizeColumnName(name));
      return row ? { color1: row.color1 || '#ffffff', color2: row.color2 || '#ffffff' } : null;
    };

    const sheetColorsA = getSheetColors(teamAName);
    const sheetColorsB = getSheetColors(teamBName);
    const savedColorsA = getTeamColors(teamAName);
    const savedColorsB = getTeamColors(teamBName);

    const colA1 = sheetColorsA?.color1 || savedColorsA.color1 || '#ffffff';
    const colA2 = sheetColorsA?.color2 || savedColorsA.color2 || '#000000';
    const colB1 = sheetColorsB?.color1 || savedColorsB.color1 || '#ffffff';
    const colB2 = sheetColorsB?.color2 || savedColorsB.color2 || '#000000';

    setColorA1(colA1);
    setColorA2(colA2);
    setColorB1(colB1);
    setColorB2(colB2);

    // Update OBS
    obs.setText('name_team_a', teamAName.replace(/\//g, '\n'));
    obs.setText('name_team_b', teamBName.replace(/\//g, '\n'));
    obs.setImage('logo_team_a', logoAFile, logoFolderPath);
    obs.setImage('logo_team_b', logoBFile, logoFolderPath);
    obs.setSourceColor('Color_Team_A', colA1);
    obs.setSourceColor('Color_Team_A_2', colA2);
    obs.setSourceColor('Color_Team_B', colB1);
    obs.setSourceColor('Color_Team_B_2', colB2);

    const l1 = getMappedValue(matchRow, 'label1', mapping, headers) || '';
    const l2 = getMappedValue(matchRow, 'label2', mapping, headers) || '';
    const l3 = getMappedValue(matchRow, 'label3', mapping, headers) || '';
    setLabel1(l1);
    setLabel2(l2);
    setLabel3(l3);
    obs.setText('label_1', l1);
    obs.setText('label_2', l2);
    obs.setText('label_3', l3);

    triggerToast(`${trans.toastLoaded} ${matchId}`, 'success');
  };

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
    const target = firebaseTargets.find((t) => t.id === selectedQuickLeagueId);
    if (!target) {
      triggerToast('กรุณาโหลดไฟล์ Excel ที่มี Firebase Config ก่อน', 'error');
      return;
    }

    const host = window.location.origin;
    let urlString = '';
    if (standaloneFile === 'league-table') {
      urlString = `${host}/league-table?league=${target.id}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
    } else if (standaloneFile === 'all-scores') {
      urlString = `${host}/all-scores?league=${target.id}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
    } else if (standaloneFile === 'all-score-combined') {
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
          {leagueName}
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
                <span>Video: กำลังเชื่อมต่อ...</span>
              ) : videoFolder.isConnected ? (
                <span>
                  Video: {videoFolder.folderName} ({videoFolder.videoFiles.length} ไฟล์)
                  {videoFolder.savedPath && (
                    <span style={{ opacity: 0.6, fontSize: '0.85em', marginLeft: '4px' }}>
                      · {videoFolder.savedPath}
                    </span>
                  )}
                </span>
              ) : (
                <span>Video: คลิกเพื่อเลือกโฟลเดอร์</span>
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
            {currentUser.photoURL && (
              <img src={currentUser.photoURL} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
            )}
            <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
              {currentUser.email}
            </span>
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



      {/* Controls Bar */}
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row space-between" style={{ gap: '8px', marginBottom: 0 }}>
          <div className="row" style={{ marginBottom: 0, gap: '6px' }}>
            <button
              className="btn-success btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="นำเข้าตารางแข่งขันจากไฟล์ Excel (.xlsx, .xls)"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <i className="fas fa-file-excel" style={{ fontSize: '0.9rem' }}></i>
              <span>นำเข้าไฟล์ Excel</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
            />
            <button
              className="btn-primary btn-sm"
              onClick={() => setShowUrlModal(true)}
              title="ดึงข้อมูลตารางแข่งขันจาก URL หรือ Google Sheets"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <i className="fas fa-link" style={{ fontSize: '0.9rem' }}></i>
              <span>นำเข้าจาก URL</span>
            </button>
            <button
              className="btn-success btn-sm"
              onClick={() => setShowTeamLogosManagerModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="จัดการและบันทึกโลโก้ทีมทั้งหมดลง Firebase Database ครั้งเดียว"
            >
              <i className="fas fa-shield-halved" style={{ fontSize: '0.9rem' }}></i>
              <span>🛡️ จัดการโลโก้ประจำลีก</span>
            </button>
          </div>

          <div className="row" style={{ marginBottom: 0, gap: '4px' }}>
            <label htmlFor="matchIDInput" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{trans.matchId}</label>
            <button
              onClick={() => {
                if (matchIdInput > 1) {
                  setMatchIdInput((prev) => prev - 1);
                  applyMatch(matchIdInput - 1);
                }
              }}
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
              onClick={() => {
                setMatchIdInput((prev) => prev + 1);
                applyMatch(matchIdInput + 1);
              }}
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
            <button className="plus" onClick={() => { setScoreA((prev) => prev + 1); broadcastScoreboardButton('goal_A'); }}>+</button>
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

            <div className="logo-container" title="คลิกเพื่อตั้งค่าโลโก้" onClick={() => setShowTeamLogosManagerModal(true)}>
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
                    {teamSheetData.length > 0 && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                        title="เลือกทีมจากรายชื่อ"
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

            <div className="logo-container" title="คลิกเพื่อตั้งค่าโลโก้" onClick={() => setShowTeamLogosManagerModal(true)}>
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
                    {teamSheetData.length > 0 && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1, maxWidth: '90px', fontSize: '0.8rem' }}
                        title="เลือกทีมจากรายชื่อ"
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
            <button className="plus" onClick={() => { setScoreB((prev) => prev + 1); broadcastScoreboardButton('goal_B'); }}>+</button>
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
      {firebaseTargets.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', textAlign: 'center' }}>บันทึกข้อมูลคะแนนแมตช์การแข่งขันไปยัง Firebase:</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {firebaseTargets.map((target) => (
              <button key={target.id} className="btn-primary" onClick={() => handleSaveMatchToFirebase(target)}>
                <i className="fas fa-save"></i> บันทึกข้อมูลแมตช์ {target.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
      {excelData.length > 0 && (
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



      <ScoreboardSettingsModal
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
      />
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
      <TeamLogosManagerModal
        isOpen={showTeamLogosManagerModal}
        onClose={() => setShowTeamLogosManagerModal(false)}
        teamList={allUniqueTeams}
        db={activeDb}
        leagueName={leagueName}
        logoFolderPath={logoFolderPath}
        onLogoFolderPathChange={setLogoFolderPath}
        onToast={triggerToast}
      />

      <PresetTimeModal
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
      />

      <QuickSetupModal
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
        onOpenObsSetup={() => {
          setShowQuickSetupModal(false);
          setShowOBSSetupModal(true);
        }}
        onCopyOverlay={handleCopyOverlayUrl}
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
      />

      <ObsSetupModal
        isOpen={showOBSSetupModal}
        closeLabel={trans.close}
        onDownload={handleDownloadTemplate}
        onClose={() => setShowOBSSetupModal(false)}
      />

      <DatabaseMatchesModal
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
      />
      <EditDatabaseMatchModal
        match={database.editingMatch}
        onSave={database.saveEditedMatch}
        onClose={database.closeEdit}
        saveLabel={trans.save}
      />

      <ScoreboardInfoModals
        trans={trans}
        showHelp={showHelpModal}
        showDonate={showDonateModal}
        showChangelog={showChangelogModal}
        onCloseHelp={() => setShowHelpModal(false)}
        onCloseDonate={() => setShowDonateModal(false)}
        onCloseChangelog={() => setShowChangelogModal(false)}
      />

      <TeamSelectModal
        isOpen={showTeamSelectModal}
        target={teamSelectTarget}
        search={teamSelectSearch}
        teams={teamSheetData}
        closeLabel={trans.close}
        onSearchChange={setTeamSelectSearch}
        onSelect={(teamName) => {
          applyTeamFromSheet(teamName, teamSelectTarget);
          setShowTeamSelectModal(false);
          setTeamSelectSearch('');
        }}
        onClose={() => setShowTeamSelectModal(false)}
      />

      <ReplayControlModals
        showVarReplayV2={showVarReplayV2Modal}
        showInstantReplay={showInstantReplayModal}
        onCloseVarReplayV2={() => setShowVarReplayV2Modal(false)}
        onCloseInstantReplay={() => setShowInstantReplayModal(false)}
      />

      <PenaltyShootoutModal
        isOpen={showPenaltyModal}
        obs={obs}
        teamNameA={nameA}
        teamNameB={nameB}
        onClose={closePenaltyModal}
      />

      {/* Auto Macros Panel */}
      {showAutoMacrosModal && (
        <AutoMacrosPanel
          obs={obs}
          onClose={() => setShowAutoMacrosModal(false)}
          customMacrosHook={autoMacros}
        />
      )}

      <ExcelUrlModal
        isOpen={showUrlModal}
        url={excelUrlInput}
        name={excelUrlNameInput}
        presets={savedExcelUrls}
        isLoading={isLoadingUrl}
        onUrlChange={setExcelUrlInput}
        onNameChange={setExcelUrlNameInput}
        onLoad={() => { void handleExcelFromUrl(); }}
        onSavePreset={handleSaveUrlPreset}
        onSelectPreset={(preset) => handleSelectUrlPreset(preset as SavedExcelUrl)}
        onDeletePreset={handleDeleteUrlPreset}
        onClose={() => setShowUrlModal(false)}
      />
    </div>
  );
}
