import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export const useTimer = () => {
  const [timer, setTimer] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [half, setHalf] = useState<string>('1st');
  const [countdownStartTime, setCountdownStartTimeState] = useState<number>(() => {
    const saved = localStorage.getItem('countdownStartTime');
    const parsed = saved ? Number.parseInt(saved, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  const [customText, setCustomText] = useState<string>(''); // For special status like 'HT', 'FT', or empty (hidden)

  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef(timer);
  const baseTimerRef = useRef(timer);
  const startedAtRef = useRef<number | null>(null);

  const syncTimer = useCallback(() => {
    if (startedAtRef.current === null) return;
    const nextTimer = baseTimerRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000);
    if (nextTimer === timerRef.current) return;
    timerRef.current = nextTimer;
    setTimer(nextTimer);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(syncTimer, 1000);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, syncTimer]);

  const start1 = () => {
    setHalf('1st');
    setCustomText('');
    baseTimerRef.current = 0;
    timerRef.current = 0;
    setTimer(0);
    startedAtRef.current = Date.now();
    setIsRunning(true);
  };

  const start2 = () => {
    setHalf('2nd');
    setCustomText('');
    baseTimerRef.current = countdownStartTime;
    timerRef.current = countdownStartTime;
    setTimer(countdownStartTime);
    startedAtRef.current = Date.now();
    setIsRunning(true);
  };

  const pause = () => {
    syncTimer();
    baseTimerRef.current = timerRef.current;
    startedAtRef.current = null;
    setIsRunning(false);
  };

  const resume = () => {
    if (customText) setCustomText('');
    baseTimerRef.current = timerRef.current;
    startedAtRef.current = Date.now();
    setIsRunning(true);
  };

  const halfpause = () => {
    syncTimer();
    baseTimerRef.current = timerRef.current;
    startedAtRef.current = null;
    setIsRunning(false);
    setHalf('');
    setCustomText('HT');
  };

  const fulltime = () => {
    syncTimer();
    baseTimerRef.current = timerRef.current;
    startedAtRef.current = null;
    setIsRunning(false);
    setHalf('');
    setCustomText('FT');
  };

  const resetToZero = () => {
    startedAtRef.current = null;
    baseTimerRef.current = 0;
    timerRef.current = 0;
    setIsRunning(false);
    setCustomText('');
    setTimer(0);
  };

  const setCountdownStartTime = (seconds: number) => {
    const nextSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    setCountdownStartTimeState(nextSeconds);
    localStorage.setItem('countdownStartTime', nextSeconds.toString());
  };

  const setTimerValue = (seconds: number) => {
    const nextSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    timerRef.current = nextSeconds;
    baseTimerRef.current = nextSeconds;
    if (startedAtRef.current !== null) startedAtRef.current = Date.now();
    setTimer(nextSeconds);
  };

  const toggleHalf = () => {
    if (customText) setCustomText('');
    setHalf((prev) => (prev === '1st' ? '2nd' : '1st'));
  };

  const formattedTime = useMemo(() => {
    if (customText) return customText;
    const m = String(Math.floor(timer / 60)).padStart(2, '0');
    const s = String(timer % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [timer, customText]);

  return {
    timer,
    isRunning,
    half,
    customText,
    countdownStartTime,
    formattedTime,
    start1,
    start2,
    pause,
    resume,
    halfpause,
    fulltime,
    resetToZero,
    setCountdownStartTime,
    setTimerValue,
    toggleHalf,
    setCustomText,
  };
};
