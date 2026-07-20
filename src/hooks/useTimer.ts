import { useState, useEffect, useRef, useMemo } from 'react';

export const useTimer = () => {
  const [timer, setTimer] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [half, setHalf] = useState<string>('1st');
  const [countdownStartTime, setCountdownStartTimeState] = useState<number>(() => {
    const saved = localStorage.getItem('countdownStartTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [customText, setCustomText] = useState<string>(''); // For special status like 'HT', 'FT', or empty (hidden)

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
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
  }, [isRunning]);

  const start1 = () => {
    setHalf('1st');
    setCustomText('');
    setTimer(0);
    setIsRunning(true);
  };

  const start2 = () => {
    setHalf('2nd');
    setCustomText('');
    setTimer(countdownStartTime);
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
  };

  const resume = () => {
    if (customText) setCustomText('');
    setIsRunning(true);
  };

  const halfpause = () => {
    setIsRunning(false);
    setHalf('');
    setCustomText('HT');
  };

  const fulltime = () => {
    setIsRunning(false);
    setHalf('');
    setCustomText('FT');
  };

  const resetToZero = () => {
    setIsRunning(false);
    setCustomText('');
    setTimer(0);
  };

  const setCountdownStartTime = (seconds: number) => {
    setCountdownStartTimeState(seconds);
    localStorage.setItem('countdownStartTime', seconds.toString());
  };

  const setTimerValue = (seconds: number) => {
    setTimer(seconds);
  };

  const toggleHalf = () => {
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
