import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { initializeApp, getApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, remove, update } from 'firebase/database';
import { useTimer } from '../hooks/useTimer';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import { useAutoMacros } from '../hooks/useAutoMacros';
import { translations } from '../constants/translations';
import {
  parseFirebaseSaveTargets,
  normalizeColumnName,
  isFirebaseConfigSheetName,
  inferExcelMapping,
  loadTeamSheetWithColors
} from '../utils/excelParser';
import type { FirebaseSaveTarget, TeamColorRow } from '../utils/excelParser';
import PenaltyShootoutController from './PenaltyShootoutController';
import AutoMacrosPanel from './AutoMacrosPanel';

export default function ScoreboardController() {
  // --- Hooks ---
  const timerHook = useTimer();
  // Stable ref so the OBS WebSocket event listener always calls the latest handleHotkeyAction
  // without being re-registered every render (avoids stale closure on hotkeys)
  const hotkeyHandlerRef = useRef<((action: string) => void) | null>(null);
  
  const obs = useOBSWebSocket(useCallback((action: string) => {
    hotkeyHandlerRef.current?.(action);
  }, []));

  // Auto Macros Hook (runs in background always)
  const autoMacros = useAutoMacros(obs);

  // --- Local States ---
  const [currentLang, setCurrentLang] = useState<string>(() => localStorage.getItem('scoreboardLang') || 'th');
  const [logoFolderPath, setLogoFolderPath] = useState<string>(() => localStorage.getItem('logoFolderPath') || 'C:/OBSAssets/logos');
  const [matchIdInput, setMatchIdInput] = useState<number>(1);
  const [leagueName, setLeagueName] = useState<string>('Football Scoreboard Controller');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});
  const [firebaseTargets, setFirebaseTargets] = useState<FirebaseSaveTarget[]>([]);
  const [teamSheetData, setTeamSheetData] = useState<TeamColorRow[]>([]);
  const [teamColorsMemory, setTeamColorsMemory] = useState<Record<string, { color1: string; color2: string }>>(() => {
    const saved = localStorage.getItem('teamColors');
    return saved ? JSON.parse(saved) : {};
  });

  // Team A and B States
  const [nameA, setNameA] = useState<string>('Team A');
  const [nameB, setNameB] = useState<string>('Team B');
  
  // Sync team names to localStorage for Penalty Shootout
  useEffect(() => {
    localStorage.setItem('penalty_teamA', nameA);
    localStorage.setItem('penalty_teamB', nameB);
  }, [nameA, nameB]);
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [colorA1, setColorA1] = useState<string>('#ffffff');
  const [colorA2, setColorA2] = useState<string>('#ffffff');
  const [colorB1, setColorB1] = useState<string>('#ffffff');
  const [colorB2, setColorB2] = useState<string>('#ffffff');
  const [logoA, setLogoA] = useState<string>('');
  const [logoB, setLogoB] = useState<string>('');

  // Editing Name State
  const [isEditingA, setIsEditingA] = useState<boolean>(false);
  const [isEditingB, setIsEditingB] = useState<boolean>(false);
  const [editNameAVal, setEditNameAVal] = useState<string>('');
  const [editNameBVal, setEditNameBVal] = useState<string>('');

  // Modals Visibility
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState<boolean>(false);
  const [showDonateModal, setShowDonateModal] = useState<boolean>(false);
  const [showLogoPathModal, setShowLogoPathModal] = useState<boolean>(false);
  const [showPresetTimeModal, setShowPresetTimeModal] = useState<boolean>(false);
  const [showQuickSetupModal, setShowQuickSetupModal] = useState<boolean>(false);
  const [showEditDatabaseMatchModal, setShowEditDatabaseMatchModal] = useState<boolean>(false);
  const [showChangelogModal, setShowChangelogModal] = useState<boolean>(false);
  const [showTeamSelectModal, setShowTeamSelectModal] = useState<boolean>(false);
  const [showAutoMacrosModal, setShowAutoMacrosModal] = useState<boolean>(false);
  const [teamSelectTarget, setTeamSelectTarget] = useState<'A' | 'B'>('A');
  const [teamSelectSearch, setTeamSelectSearch] = useState<string>('');

  // OBS Setup Wizard States
  const [showOBSSetupModal, setShowOBSSetupModal] = useState<boolean>(false);

  // Custom Preset Time Input
  const [customTimeMinutes, setCustomTimeMinutes] = useState<number>(0);
  const [customTimeSeconds, setCustomTimeSeconds] = useState<number>(0);

  // Announcement details text
  const [detailsTemplate, setDetailsTemplate] = useState<string>(() => localStorage.getItem('detailsText') || '');

  // Database Viewer States
  const [selectedQuickLeagueId, setSelectedQuickLeagueId] = useState<string>('');
  const [dbMatches, setDbMatches] = useState<any[]>([]);
  const [dbSearchTerm, setDbSearchTerm] = useState<string>('');
  const [dbFilterDate, setDbFilterDate] = useState<string>('all');
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [editingDbMatch, setEditingDbMatch] = useState<any>(null);

  // Toast States
  const [toasts, setToasts] = useState<{ id: string; message: string; type: string }[]>([]);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firebaseAppsRef = useRef<Record<string, FirebaseApp>>({});

  const trans = translations[currentLang] || translations.en;

  // --- Toast Function ---
  const triggerToast = (message: string, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // --- Prevent spacebar default behavior ---
  useEffect(() => {
    const preventSpacebar = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', preventSpacebar);
    
    return () => {
      window.removeEventListener('keydown', preventSpacebar);
    };
  }, []);

  // --- Initialize OBS ---
  useEffect(() => {
    obs.connect('ws://localhost:4455').then((connected) => {
      if (connected) triggerToast(trans.toastObsSuccess, 'success');
    }).catch(() => {
      triggerToast(trans.toastObsError, 'error');
    });
    return () => {
      obs.disconnect();
    };
  }, []);

  // --- Sync local scores & timer to OBS ---
  useEffect(() => {
    obs.setText('score_team_a', String(scoreA));
  }, [scoreA, obs.isConnected]);

  useEffect(() => {
    obs.setText('score_team_b', String(scoreB));
  }, [scoreB, obs.isConnected]);

  useEffect(() => {
    obs.setText('time_counter', timerHook.formattedTime);
  }, [timerHook.formattedTime, obs.isConnected]);

  useEffect(() => {
    obs.setText('half_text', timerHook.half);
  }, [timerHook.half, obs.isConnected]);

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
    const logoFile = `${teamName}.png`;

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
  const getLogoSrc = (logoName: string) => {
    if (!logoName) return '';
    
    // Auto-append .png if not present
    let fileName = logoName;
    if (!fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
      fileName = `${fileName}.png`;
    }
    
    // In production (deployed), always use /logos/ folder
    // In development, use custom path if configured
    const isDev = import.meta.env.DEV;
    
    if (isDev && logoFolderPath) {
      // Development mode with custom path
      return `/api/logo?path=${encodeURIComponent(logoFolderPath)}&file=${encodeURIComponent(fileName)}`;
    }
    
    // Production or no custom path - use deployed logos folder
    return `/logos/${encodeURIComponent(fileName)}`;
  };

  // --- Excel Loading & Parsing Logic ---
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Run Excel parse (XLSX) and color extraction (ExcelJS) in parallel
    const parseRows = new Promise<{ rows: any[][]; mapping: Record<string, string>; targets: FirebaseSaveTarget[] }>(
      (resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
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
            resolve({ rows, mapping, targets });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }
    );

    Promise.all([parseRows, loadTeamSheetWithColors(file)])
      .then(([{ rows, mapping, targets }, colors]) => {
        // Commit all parsed data to state
        setExcelData(rows);
        setExcelMapping(mapping);
        setTeamSheetData(colors);
        setFirebaseTargets(targets);
        if (targets.length > 0) setSelectedQuickLeagueId(targets[0].id);

        const lName = targets.length > 0 ? targets[0].name : file.name.replace(/\.[^/.]+$/, '');
        setLeagueName(lName);
        document.title = `${lName} - Scoreboard Controller`;

        // Auto-load match ID 1 with fresh data (rows, mapping, colors all available)
        applyMatch(1, rows, colors);
      })
      .catch((err: any) => {
        triggerToast(err.message || 'Error parsing Excel file', 'error');
      });
  };

  const getMappedValue = (row: any[], fieldKey: string, currentMapping = excelMapping, currentHeaders = excelData[0] || []) => {
    const columnName = currentMapping[fieldKey];
    if (!columnName) return '';
    const idx = currentHeaders.indexOf(columnName);
    return idx >= 0 ? row[idx] ?? '' : '';
  };

  const getMatchIdValue = (row: any[], currentMapping = excelMapping, currentHeaders = excelData[0] || []) => {
    const mapped = getMappedValue(row, 'matchId', currentMapping, currentHeaders);
    if (mapped !== '') return mapped;
    return row[0] ?? '';
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

    // Logos
    const logoAFile = getMappedValue(matchRow, 'logoA', mapping, headers);
    const logoBFile = getMappedValue(matchRow, 'logoB', mapping, headers);
    setLogoA(logoAFile);
    setLogoB(logoBFile);

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

    obs.setText('label_1', getMappedValue(matchRow, 'label1', mapping, headers));
    obs.setText('label_2', getMappedValue(matchRow, 'label2', mapping, headers));
    obs.setText('label_3', getMappedValue(matchRow, 'label3', mapping, headers));

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

  // --- Dynamic Firebase Apps manager ---
  const getOrCreateFirebaseApp = (target: FirebaseSaveTarget) => {
    const appName = `ExcelLeague_${target.id.replace(/[^A-Za-z0-9_]/g, '_')}_${target.index}`;
    if (getApps().some((app) => app.name === appName)) {
      return getApp(appName);
    }
    const app = initializeApp(target.firebaseConfig, appName);
    firebaseAppsRef.current[appName] = app;
    return app;
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
        scoreA: parseInt(String(scoreA), 10),
        scoreB: parseInt(String(scoreB), 10),
        roundLabel: obsGetLabel2Value(),
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

  // Extract labels
  const obsGetLabel2Value = () => {
    if (!excelData.length) return '';
    const matchRow = excelData.slice(1).find((r) => parseInt(getMatchIdValue(r)) === matchIdInput);
    return matchRow ? getMappedValue(matchRow, 'label2') : '';
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
      .replace(/<half_text>/gi, timerHook.half);

    navigator.clipboard
      .writeText(filled)
      .then(() => triggerToast(trans.toastCopied, 'info'))
      .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
  };

  // --- Database management functions ---
  const loadDatabaseMatches = () => {
    const target = firebaseTargets.find((t) => t.id === selectedQuickLeagueId);
    if (!target) {
      triggerToast('กรุณาเลือก League ก่อน', 'error');
      return;
    }

    setDbLoading(true);
    try {
      const app = getOrCreateFirebaseApp(target);
      const db = getDatabase(app);
      const matchesRef = ref(db, 'matches');

      onValue(
        matchesRef,
        (snapshot) => {
          const val = snapshot.val();
          const items: any[] = [];
          if (val) {
            Object.keys(val).forEach((key) => {
              items.push({ id: key, ...val[key] });
            });
          }

          items.sort((a, b) => {
            const dateA = new Date(a.date || '1970-01-01');
            const dateB = new Date(b.date || '1970-01-01');
            return dateB.getTime() - dateA.getTime();
          });

          setDbMatches(items);
          setDbLoading(false);
        },
        (error) => {
          setDbLoading(false);
          triggerToast('Error: ' + error.message, 'error');
        }
      );
    } catch (err: any) {
      setDbLoading(false);
      triggerToast('Error: ' + err.message, 'error');
    }
  };

  const deleteDatabaseMatch = (matchId: string, tA: string, tB: string) => {
    if (!window.confirm(`ต้องการลบแมตช์ ${tA} vs ${tB} ใช่หรือไม่?`)) return;

    const target = firebaseTargets.find((t) => t.id === selectedQuickLeagueId);
    if (!target) return;

    try {
      const app = getOrCreateFirebaseApp(target);
      const db = getDatabase(app);
      const matchRef = ref(db, `matches/${matchId}`);

      remove(matchRef)
        .then(() => {
          triggerToast('ลบข้อมูลสำเร็จ', 'success');
          loadDatabaseMatches();
        })
        .catch((err) => triggerToast('ลบข้อมูลไม่สำเร็จ: ' + err.message, 'error'));
    } catch (err: any) {
      triggerToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleOpenEditDbMatchModal = (match: any) => {
    setEditingDbMatch(match);
    setShowEditDatabaseMatchModal(true);
  };

  const saveDbMatchEdit = () => {
    if (!editingDbMatch) return;

    const target = firebaseTargets.find((t) => t.id === selectedQuickLeagueId);
    if (!target) return;

    try {
      const app = getOrCreateFirebaseApp(target);
      const db = getDatabase(app);
      const matchRef = ref(db, `matches/${editingDbMatch.id}`);

      const updated = {
        date: editingDbMatch.date,
        teamA: editingDbMatch.teamA,
        scoreA: parseInt(editingDbMatch.scoreA, 10) || 0,
        teamB: editingDbMatch.teamB,
        scoreB: parseInt(editingDbMatch.scoreB, 10) || 0,
        roundLabel: editingDbMatch.roundLabel || '',
        url: editingDbMatch.url || ''
      };

      update(matchRef, updated)
        .then(() => {
          triggerToast('บันทึกข้อมูลสำเร็จ', 'success');
          setShowEditDatabaseMatchModal(false);
          loadDatabaseMatches();
        })
        .catch((err) => triggerToast('บันทึกไม่สำเร็จ: ' + err.message, 'error'));
    } catch (err: any) {
      triggerToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Filtered DB Matches
  const filteredDbMatches = dbMatches.filter((match) => {
    const searchVal = dbSearchTerm.toLowerCase();
    const tA = (match.teamA || '').toLowerCase();
    const tB = (match.teamB || '').toLowerCase();
    const round = (match.roundLabel || '').toLowerCase();
    const matchesSearch = tA.includes(searchVal) || tB.includes(searchVal) || round.includes(searchVal);

    if (!matchesSearch) return false;

    if (dbFilterDate === 'all') return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mDate = new Date(match.date || '1970-01-01');
    mDate.setHours(0, 0, 0, 0);

    if (dbFilterDate === 'today') {
      return mDate.getTime() === today.getTime();
    } else if (dbFilterDate === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return mDate >= weekAgo && mDate <= today;
    } else if (dbFilterDate === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return mDate >= monthAgo && mDate <= today;
    }
    return true;
  });

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
    } else {
      urlString = `${host}/overlay?league=${target.id}&view=${viewType}&title=${encodeURIComponent(target.name)}&fb=${getOverlaySearchBase64(target)}`;
      if (viewType === 'ticker') {
        urlString += `&date=today`;
      }
    }

    navigator.clipboard
      .writeText(urlString)
      .then(() => triggerToast(trans.toastCopied, 'success'))
      .catch(() => triggerToast(trans.toastCopyFailed, 'error'));
  };

  const getHeaderIndex = (fieldKey: string) => {
    const columnName = excelMapping[fieldKey];
    if (!columnName) return -1;
    return (excelData[0] || []).indexOf(columnName);
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
    } catch (err) {
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
      <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-color)' }}>
          {leagueName}
        </h1>
      </div>

      {/* Controls Bar */}
      <div className="card">
        <div className="row space-between">
          <div className="row" style={{ marginBottom: 0 }}>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <i className="fas fa-file-excel"></i>
              <span>{trans.excel}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
            />
            <button className="btn-secondary" title={trans.logoPathHint} onClick={() => setShowLogoPathModal(true)}>
              <i className="fas fa-folder-open"></i>
            </button>
          </div>

          <div className="row" style={{ marginBottom: 0 }}>
            <label htmlFor="matchIDInput" style={{ fontWeight: 600 }}>{trans.matchId}</label>
            <button
              onClick={() => {
                if (matchIdInput > 1) {
                  setMatchIdInput((prev) => prev - 1);
                  applyMatch(matchIdInput - 1);
                }
              }}
              style={{ padding: '6px 10px', background: '#333', color: '#fff', borderRadius: '4px' }}
            >
              &lt;
            </button>
            <input
              type="number"
              id="matchIDInput"
              min="1"
              value={matchIdInput}
              onChange={(e) => setMatchIdInput(parseInt(e.target.value, 10) || 1)}
            />
            <button
              onClick={() => {
                setMatchIdInput((prev) => prev + 1);
                applyMatch(matchIdInput + 1);
              }}
              style={{ padding: '6px 10px', background: '#333', color: '#fff', borderRadius: '4px' }}
            >
              &gt;
            </button>
            <button className="btn-primary" onClick={() => applyMatch()}>
              <i className="fas fa-check"></i>
              <span>{trans.load}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Team score and editor panel */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          {/* Score Team A */}
          <div className="score-buttons">
            <button className="plus" onClick={() => setScoreA((prev) => prev + 1)}>+</button>
            <button className="minus" onClick={() => setScoreA((prev) => Math.max(0, prev - 1))}>-</button>
          </div>

          <div className="score-display">{scoreA}</div>

          {/* Team Row A */}
          <div className="team-row" style={{ flex: 1, minWidth: '150px' }}>
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

            <div className="logo-container">
              {logoA ? (
                <img
                  src={getLogoSrc(logoA)}
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
                  <div className="name" dangerouslySetInnerHTML={{ __html: nameA.replace(/\//g, '<br>') }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-warning"
              onClick={swapTeams}
              style={{ height: '55px', width: '55px', borderRadius: '50%', fontSize: '1.4rem' }}
            >
              <i className="fas fa-exchange-alt"></i>
            </button>
            <button className="btn-secondary" onClick={resetScore} style={{ borderRadius: '20px', fontSize: '0.85rem' }}>
              <i className="fas fa-sync-alt"></i>
              <span>{trans.reset}</span>
            </button>
          </div>

          {/* Team Row B */}
          <div className="team-row" style={{ flex: 1, minWidth: '150px' }}>
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

            <div className="logo-container">
              {logoB ? (
                <img
                  src={getLogoSrc(logoB)}
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
                  <div className="name" dangerouslySetInnerHTML={{ __html: nameB.replace(/\//g, '<br>') }} />
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

          <div className="score-display">{scoreB}</div>

          <div className="score-buttons">
            <button className="plus" onClick={() => setScoreB((prev) => prev + 1)}>+</button>
            <button className="minus" onClick={() => setScoreB((prev) => Math.max(0, prev - 1))}>-</button>
          </div>
        </div>
      </div>

      {/* Labels display bar */}
      {excelData.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', background: '#0f1115', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <strong>Label 1:</strong> {getHeaderIndex('label1') >= 0 ? excelData.slice(1).find((r) => parseInt(getMatchIdValue(r)) === matchIdInput)?.[getHeaderIndex('label1')] || '-' : '-'}
            </div>
            <div style={{ flex: 1, minWidth: '200px', background: '#0f1115', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <strong>Label 2:</strong> {obsGetLabel2Value() || '-'}
            </div>
            <div style={{ flex: 1, minWidth: '200px', background: '#0f1115', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <strong>Label 3:</strong> {getHeaderIndex('label3') >= 0 ? excelData.slice(1).find((r) => parseInt(getMatchIdValue(r)) === matchIdInput)?.[getHeaderIndex('label3')] || '-' : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Announcement Scrolling Text */}
      {detailsTemplate.trim() && (
        <div className="card" style={{ padding: '6px 12px' }}>
          <div className="announcement-container">
            <span className="announcement-text">{detailsTemplate}</span>
          </div>
        </div>
      )}

      {/* Timer and Half Controls */}
      <div className="card">
        <div className="row timer-area-container">
          <div style={{ flex: '0 0 80px', display: 'flex' }}>
            <button className="btn-secondary" onClick={timerHook.toggleHalf} style={{ width: '100%', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem' }}>{trans.half}</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{timerHook.half || 'HT'}</span>
            </button>
          </div>

          <div className="timer-display-area">
            <div className="timer-display">{timerHook.formattedTime}</div>
            <div className="row center" style={{ marginTop: '8px' }}>
              <button className="btn-success" onClick={timerHook.start1}>
                <i className="fas fa-play"></i> เริ่มครึ่งแรก
              </button>
              <button className="btn-danger" onClick={timerHook.halfpause}>
                <i className="fas fa-pause"></i> พักครึ่งแรก
              </button>
            </div>
            <div className="row center" style={{ marginTop: '8px' }}>
              <button className="btn-success" onClick={timerHook.start2}>
                <i className="fas fa-play"></i> เริ่มครึ่งหลัง
              </button>
              <button className="btn-danger" onClick={timerHook.fulltime}>
                <i className="fas fa-pause"></i> จบเกมส์
              </button>
            </div>
            <div className="row center" style={{ marginTop: '8px' }}>
              <button
                className="btn-warning"
                onClick={() => {
                  timerHook.pause();
                  obs.setText('time_counter', '');
                }}
              >
                ซ่อนเวลา
              </button>
            </div>
          </div>

          <div className="timer-right-controls">
            <button className="btn-secondary" onClick={() => setShowPresetTimeModal(true)}>
              <i className="fas fa-clock"></i> ปรับเวลา
            </button>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: '#10b981',
                padding: '6px 12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px'
              }}
            >
              ปัจจุบัน: {Math.floor(timerHook.countdownStartTime / 60)} นาที
            </div>
            <button 
              className="btn-primary" 
              onClick={async () => {
                // Show Penalty source and hide Main_events when opening modal
                try {
                  const penaltyId = await obs.getSceneItemId('Main Stream', 'Penalty');
                  if (penaltyId !== null) {
                    await obs.setSceneItemEnabled('Main Stream', penaltyId, true);
                    console.log('[Scoreboard] Penalty source shown');
                  }
                  
                  const mainEventsId = await obs.getSceneItemId('Main Stream', 'Main_events');
                  if (mainEventsId !== null) {
                    await obs.setSceneItemEnabled('Main Stream', mainEventsId, false);
                    console.log('[Scoreboard] Main_events source hidden');
                  }
                } catch (err) {
                  console.error('[Scoreboard] Error toggling sources:', err);
                }
                
                // Open penalty shootout modal
                setShowPenaltyModal(true);
              }}
            >
              ยิงจุดโทษ
            </button>
          </div>
        </div>
      </div>

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
          <button className="btn-secondary" title={trans.settings} onClick={() => setShowSettingsModal(true)}>
            <i className="fas fa-cog"></i>
          </button>
          <button className="btn-danger" title={trans.copy} onClick={copyDetailsToClipboard}>
            <i className="fas fa-copy"></i>
          </button>
          <button className="btn-secondary" title={trans.help} onClick={() => setShowHelpModal(true)}>
            <i className="fas fa-question-circle"></i>
          </button>
          <button className="btn-secondary" title={trans.donate} onClick={() => setShowDonateModal(true)}>
            <i className="fas fa-hand-holding-usd"></i>
          </button>
          <select
            value={currentLang}
            onChange={(e) => {
              setCurrentLang(e.target.value);
              localStorage.setItem('scoreboardLang', e.target.value);
            }}
          >
            <option value="th">ภาษาไทย</option>
            <option value="en">English</option>
            <option value="ko">한국어</option>
            <option value="lo">ພາສາລາວ</option>
            <option value="km">ភាសាខ្មែរ</option>
            <option value="pt-br">Português (BR)</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        color: 'var(--text-muted-color)',
        fontSize: '0.75rem',
        padding: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <span>{trans.footerAppName}</span>
        <span>—</span>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-color)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.75rem',
            textDecoration: 'underline'
          }}
          onClick={() => setShowChangelogModal(true)}
        >
          {trans.changelog}
        </button>
      </div>

      {/* --- Settings Modal --- */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-cog"></i> {trans.settings}
            </h3>
            <p style={{ color: 'var(--text-muted-color)', marginBottom: '16px' }}>{trans.detailsDesc}</p>
            <textarea
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              value={detailsTemplate}
              onChange={(e) => setDetailsTemplate(e.target.value)}
            />
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  localStorage.setItem('detailsText', detailsTemplate);
                  setShowSettingsModal(false);
                  triggerToast(trans.toastSaved, 'success');
                }}
              >
                {trans.save}
              </button>
              <button className="btn-secondary" onClick={() => setShowSettingsModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Logo Folder Path Settings Modal --- */}
      {showLogoPathModal && (
        <div className="modal-overlay" onClick={() => setShowLogoPathModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-folder-open"></i> {trans.logoPathTitle || 'ที่เก็บรูปโลโก้ทีม'}
            </h3>
            <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>
              {trans.logoPathDesc || 'ตั้งค่าโฟลเดอร์สำหรับโหลดโลโก้ทีมลง OBS'}
            </p>
            <input
              type="text"
              style={{ width: '100%', marginBottom: '12px' }}
              value={logoFolderPath}
              onChange={(e) => setLogoFolderPath(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  localStorage.setItem('logoFolderPath', logoFolderPath);
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
          </div>
        </div>
      )}

      {/* --- Adjust Preset Starts Modal --- */}
      {showPresetTimeModal && (
        <div className="modal-overlay" onClick={() => setShowPresetTimeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-clock"></i> {trans.timeSettingsTitle || 'ปรับแต่งเวลาเริ่มต้นครึ่งหลัง'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[0, 15, 20, 25, 30, 35, 40, 45].map((m) => (
                <button
                  key={m}
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    timerHook.setCountdownStartTime(m * 60);
                    setShowPresetTimeModal(false);
                    triggerToast(`ตั้งเวลาครึ่งหลังเป็น ${m} นาทีแล้ว`, 'success');
                  }}
                >
                  <i className="fas fa-clock"></i>
                  {m === 0 ? '0 นาที' : `${m} นาที`}
                </button>
              ))}
            </div>

            {/* Custom time input */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <p style={{ color: 'var(--text-muted-color)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>
                หรือกำหนดเวลาเอง (นาที : วินาที):
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="0"
                  max="999"
                  style={{ width: '80px', fontSize: '1.2rem', textAlign: 'center' }}
                  value={customTimeMinutes}
                  onChange={(e) => setCustomTimeMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  style={{ width: '80px', fontSize: '1.2rem', textAlign: 'center' }}
                  value={customTimeSeconds}
                  onChange={(e) => setCustomTimeSeconds(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    const totalSeconds = customTimeMinutes * 60 + customTimeSeconds;
                    timerHook.setCountdownStartTime(totalSeconds);
                    setShowPresetTimeModal(false);
                    triggerToast(`ตั้งเวลาเป็น ${customTimeMinutes} นาที ${customTimeSeconds} วินาทีแล้ว`, 'success');
                  }}
                >
                  <i className="fas fa-save"></i> บันทึก
                </button>
              </div>
              <button
                className="btn-success"
                style={{ marginTop: '8px', width: '100%' }}
                onClick={() => {
                  const totalSeconds = customTimeMinutes * 60 + customTimeSeconds;
                  timerHook.setCountdownStartTime(totalSeconds);
                  timerHook.setTimerValue(totalSeconds);
                  setShowPresetTimeModal(false);
                  triggerToast(`ตั้งและใช้งานเวลา ${customTimeMinutes} นาที ${customTimeSeconds} วินาทีทันที`, 'success');
                }}
              >
                <i className="fas fa-sync-alt"></i> บันทึกและใช้งานทันที
              </button>
            </div>

            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowPresetTimeModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Help Modal --- */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-question-circle"></i> {trans.helpTitle}
            </h3>
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep1 }} />
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep2 }} />
            <div dangerouslySetInnerHTML={{ __html: trans.helpStep3 }} />
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setShowHelpModal(false)}>
                {trans.understand}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Donate Modal --- */}
      {showDonateModal && (
        <div className="modal-overlay" onClick={() => setShowDonateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-hand-holding-usd"></i> {trans.donateTitle}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div>{trans.donateThai}</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://easydonate.app/Jamornz" alt="" />
              <a href="https://easydonate.app/Jamornz" target="_blank" rel="noreferrer">https://easydonate.app/Jamornz</a>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowDonateModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Quick Setup & URLs Modal --- */}
      {showQuickSetupModal && (
        <div className="modal-overlay" onClick={() => setShowQuickSetupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-sliders"></i> Quick Setup
            </h3>
            <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>คัดลอก Overlay URL ไปใส่เป็น Browser Source ใน OBS Studio</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>เลือกลีกฟุตบอล:</label>
              <select
                style={{ width: '100%' }}
                value={selectedQuickLeagueId}
                onChange={(e) => setSelectedQuickLeagueId(e.target.value)}
              >
                {firebaseTargets.length === 0 ? (
                  <option value="">⚠️ โหลดไฟล์ Excel ก่อน</option>
                ) : (
                  firebaseTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="btn-primary" 
                style={{ background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 'bold' }}
                onClick={() => {
                  setShowQuickSetupModal(false);
                  setShowOBSSetupModal(true);
                }}
              >
                <i className="fas fa-download"></i> 📦 ดาวน์โหลด OBS Scene Collection
              </button>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }}></div>
              <button className="btn-primary" onClick={() => handleCopyOverlayUrl('table')}>
                <i className="fas fa-table"></i> Copy League Table URL
              </button>
              <button className="btn-success" onClick={() => handleCopyOverlayUrl('results')}>
                <i className="fas fa-list"></i> Copy Match Results URL
              </button>
              <button className="btn-warning" onClick={() => handleCopyOverlayUrl('ticker')}>
                <i className="fas fa-tv"></i> Copy Live Ticker URL
              </button>
              <button
                className="btn-secondary"
                style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
                onClick={() => {
                  if (!selectedQuickLeagueId) {
                    triggerToast('กรุณาเลือกลีกก่อน', 'error');
                    return;
                  }
                  setShowQuickSetupModal(false);
                  setShowDatabaseModal(true);
                  loadDatabaseMatches();
                }}
              >
                <i className="fas fa-database"></i> จัดการฐานข้อมูล (Firebase)
              </button>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowQuickSetupModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- OBS Scene Collection Download Modal --- */}
      {showOBSSetupModal && (
        <div className="modal-overlay" onClick={() => setShowOBSSetupModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-download"></i> ดาวน์โหลด OBS Scene Collection
            </h3>

            <div style={{ 
              marginBottom: '20px', 
              padding: '20px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '12px' }}>📦</div>
              <button
                className="btn-primary"
                onClick={handleDownloadTemplate}
                style={{ 
                  fontSize: '1.1rem',
                  padding: '14px 32px',
                  background: '#fff',
                  color: '#667eea',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <i className="fas fa-download"></i> ดาวน์โหลด React.json
              </button>
              <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#e0e7ff' }}>
                ขนาดไฟล์: ~318KB | รองรับ OBS Studio 28+<br/>
                <small style={{ fontSize: '0.75rem', opacity: 0.8 }}>คลิกเพื่อคัดลอก URL → เปิด Chrome → Paste (Ctrl+V)</small>
              </p>
            </div>

            <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px', fontSize: '0.9rem' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-list-ol"></i> ขั้นตอนการติดตั้ง
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8', color: '#cbd5e1' }}>
                <li>คลิกปุ่ม <strong>"ดาวน์โหลด React.json"</strong> ด้านบน</li>
                <li>เปิด <strong>OBS Studio</strong></li>
                <li>ไปที่เมนู <strong>Scene Collection → Import</strong></li>
                <li>เลือกไฟล์ <strong>React.json</strong> ที่ดาวน์โหลดมา</li>
                <li>OBS จะสร้าง Scene Collection ใหม่ชื่อ <strong>"React"</strong></li>
                <li>เปลี่ยนไปใช้ Scene Collection <strong>"React"</strong></li>
                <li>เสร็จสิ้น! สามารถใช้งานได้ทันที 🎉</li>
              </ol>
            </div>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: '#064e3b', 
              borderRadius: '6px', 
              borderLeft: '4px solid #10b981',
              fontSize: '0.85rem',
              color: '#a7f3d0'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <i className="fas fa-lightbulb" style={{ marginTop: '2px', color: '#fbbf24' }}></i>
                <div>
                  <strong style={{ color: '#6ee7b7' }}>เคล็ดลับ:</strong> หลัง Import แล้ว Sources ทั้งหมดจะเชื่อมต่อกับ Controller นี้อัตโนมัติผ่าน OBS WebSocket 
                  คุณสามารถปรับตำแหน่ง ขนาด หรือสีของ Sources ใน OBS ได้ตามต้องการ<br/><br/>
                  <strong style={{ color: '#fbbf24' }}>� วิธีดาวน์โหลด:</strong> 
                  1. คลิกปุ่มดาวน์โหลด → URL จะถูกคัดลอกอัตโนมัติ<br/>
                  2. เปิด Chrome (หรือเบราว์เซอร์อื่น)<br/>
                  3. กด Ctrl+V ที่ Address Bar<br/>
                  4. กด Enter → ไฟล์จะดาวน์โหลดที่โฟลเดอร์ Downloads
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowOBSSetupModal(false)}
              >
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Manage Firebase Matches Database Modal --- */}
      {showDatabaseModal && (
        <div className="modal-overlay" onClick={() => setShowDatabaseModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-database"></i> จัดการข้อมูลลีกและแมตช์ใน Realtime Database
            </h3>

            <div className="row space-between" style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="ค้นหา (ชื่อทีม/รอบ)..."
                value={dbSearchTerm}
                onChange={(e) => setDbSearchTerm(e.target.value)}
                style={{ flex: 1, maxWidth: '300px' }}
              />
              <select value={dbFilterDate} onChange={(e) => setDbFilterDate(e.target.value)}>
                <option value="all">แสดงผลทั้งหมด</option>
                <option value="today">เฉพาะวันนี้</option>
                <option value="week">ภายใน 7 วันนี้</option>
                <option value="month">ภายใน 30 วันนี้</option>
              </select>
              <button className="btn-primary" onClick={loadDatabaseMatches}>
                <i className="fas fa-sync-alt"></i> รีเฟรช
              </button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '350px', background: '#0f1115', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {dbLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1d212a', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>วันที่</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>ทีม A</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>คะแนน</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>ทีม B</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>รอบ</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDbMatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted-color)' }}>
                          ไม่พบข้อมูลแมตช์การแข่งขัน
                        </td>
                      </tr>
                    ) : (
                      filteredDbMatches.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px' }}>{m.date}</td>
                          <td style={{ padding: '8px' }}>{m.teamA}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                            {m.scoreA} - {m.scoreB}
                          </td>
                          <td style={{ padding: '8px' }}>{m.teamB}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{m.roundLabel || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              className="btn-primary"
                              style={{ padding: '4px 8px', marginRight: '4px' }}
                              onClick={() => handleOpenEditDbMatchModal(m)}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              className="btn-danger"
                              style={{ padding: '4px 8px' }}
                              onClick={() => deleteDatabaseMatch(m.id, m.teamA, m.teamB)}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  handleCopyOverlayUrl('table', 'league-table');
                }}
              >
                <i className="fas fa-copy"></i> คัดลอกตารางคะแนน Standalone URL
              </button>
              <button
                className="btn-success"
                onClick={() => {
                  handleCopyOverlayUrl('results', 'all-scores');
                }}
              >
                <i className="fas fa-copy"></i> คัดลอกผลการแข่ง Standalone URL
              </button>
              <button className="btn-secondary" onClick={() => setShowDatabaseModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Edit Match Modal --- */}
      {showEditDatabaseMatchModal && editingDbMatch && (
        <div className="modal-overlay" onClick={() => setShowEditDatabaseMatchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fas fa-edit"></i> แก้ไขผลการแข่งขันในฐานข้อมูล
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>วันที่:</label>
                <input
                  type="text"
                  value={editingDbMatch.date || ''}
                  onChange={(e) => setEditingDbMatch({ ...editingDbMatch, date: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px' }}>ทีม A:</label>
                  <input
                    type="text"
                    value={editingDbMatch.teamA || ''}
                    onChange={(e) => setEditingDbMatch({ ...editingDbMatch, teamA: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px' }}>คะแนน A:</label>
                  <input
                    type="number"
                    value={editingDbMatch.scoreA ?? 0}
                    onChange={(e) => setEditingDbMatch({ ...editingDbMatch, scoreA: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px' }}>ทีม B:</label>
                  <input
                    type="text"
                    value={editingDbMatch.teamB || ''}
                    onChange={(e) => setEditingDbMatch({ ...editingDbMatch, teamB: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px' }}>คะแนน B:</label>
                  <input
                    type="number"
                    value={editingDbMatch.scoreB ?? 0}
                    onChange={(e) => setEditingDbMatch({ ...editingDbMatch, scoreB: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>รอบ (Round Label):</label>
                <input
                  type="text"
                  value={editingDbMatch.roundLabel || ''}
                  onChange={(e) => setEditingDbMatch({ ...editingDbMatch, roundLabel: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={saveDbMatchEdit}>
                {trans.save}
              </button>
              <button className="btn-secondary" onClick={() => setShowEditDatabaseMatchModal(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Changelog Modal --- */}
      {showChangelogModal && (
        <div className="modal-overlay" onClick={() => setShowChangelogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>
              <i className="fas fa-history"></i> {trans.changelogTitle || 'Changelog'}
            </h3>
            <div
              style={{ maxHeight: '60vh', overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: (trans as any).changelogContent || '<p>No changelog available.</p>' }}
            />
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setShowChangelogModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Team Select Modal --- */}
      {showTeamSelectModal && (
        <div className="modal-overlay" onClick={() => setShowTeamSelectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>
              <i className="fas fa-users"></i> เลือกทีม{teamSelectTarget}
            </h3>
            <p style={{ color: 'var(--text-muted-color)', margin: '0 0 12px 0', fontSize: '0.9rem' }}>
              เลือกทีมจากรายชื่อใน Excel Sheet
            </p>
            <input
              type="text"
              placeholder="ค้นหาทีม..."
              value={teamSelectSearch}
              onChange={(e) => setTeamSelectSearch(e.target.value)}
              style={{ width: '100%', marginBottom: '12px' }}
              autoFocus
            />
            <div className="team-select-grid">
              {teamSheetData
                .filter((row) =>
                  !teamSelectSearch || row.team.toLowerCase().includes(teamSelectSearch.toLowerCase())
                )
                .map((row) => (
                  <button
                    key={row.team}
                    className="team-select-item"
                    onClick={() => applyTeamFromSheet(row.team, teamSelectTarget)}
                  >
                    <div
                      className="team-select-logo"
                      style={{ background: row.color1 || '#333' }}
                    >
                      <img
                        src={`/logos/${encodeURIComponent(
                          row.team.endsWith('.png') ? row.team : `${row.team}.png`
                        )}`}
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {row.team.substring(0, 2).toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontWeight: 600, textAlign: 'left' }}>{row.team}</span>
                    {row.color1 && (
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: row.color1, border: '2px solid #333', flexShrink: 0
                      }} />
                    )}
                    {row.color2 && (
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: row.color2, border: '2px solid #333', flexShrink: 0
                      }} />
                    )}
                  </button>
                ))}
              {teamSheetData.filter((row) =>
                !teamSelectSearch || row.team.toLowerCase().includes(teamSelectSearch.toLowerCase())
              ).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted-color)' }}>
                  <i className="fas fa-search"></i> ไม่พบทีม
                </div>
              )}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowTeamSelectModal(false)}>
                {trans.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Shootout Modal */}
      {showPenaltyModal && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            // Close only if clicking the backdrop
            if (e.target === e.currentTarget) {
              setShowPenaltyModal(false);
              // Hide Penalty and show Main_events when closing
              obs.getSceneItemId('Main Stream', 'Penalty').then(id => {
                if (id !== null) obs.setSceneItemEnabled('Main Stream', id, false);
              });
              obs.getSceneItemId('Main Stream', 'Main_events').then(id => {
                if (id !== null) obs.setSceneItemEnabled('Main Stream', id, true);
              });
            }
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '700px',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
          >
            <button
              onClick={() => {
                setShowPenaltyModal(false);
                // Hide Penalty and show Main_events when closing
                obs.getSceneItemId('Main Stream', 'Penalty').then(id => {
                  if (id !== null) obs.setSceneItemEnabled('Main Stream', id, false);
                });
                obs.getSceneItemId('Main Stream', 'Main_events').then(id => {
                  if (id !== null) obs.setSceneItemEnabled('Main Stream', id, true);
                });
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              title="ปิด"
            >
              ×
            </button>
            <PenaltyShootoutController 
              obs={obs}
              teamNameA={nameA}
              teamNameB={nameB}
              onClose={() => {
                setShowPenaltyModal(false);
                // Hide Penalty and show Main_events when closing
                obs.getSceneItemId('Main Stream', 'Penalty').then(id => {
                  if (id !== null) obs.setSceneItemEnabled('Main Stream', id, false);
                });
                obs.getSceneItemId('Main Stream', 'Main_events').then(id => {
                  if (id !== null) obs.setSceneItemEnabled('Main Stream', id, true);
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Auto Macros Panel */}
      {showAutoMacrosModal && (
        <AutoMacrosPanel 
          obs={obs}
          onClose={() => setShowAutoMacrosModal(false)}
          replayMacro={autoMacros.replayMacro}
          mainStreamMacro={autoMacros.mainStreamMacro}
        />
      )}
    </div>
  );
}
