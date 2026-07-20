import { useState, useEffect } from 'react';

interface PenaltySettings {
  dotSize: number;
  dotGap: number;
  teamGap: number;
  layout: 'side-by-side' | 'top-bottom';
}

export default function PenaltyDotsOverlay() {
  const [shotsA, setShotsA] = useState<(boolean | null)[]>(Array(5).fill(null));
  const [shotsB, setShotsB] = useState<(boolean | null)[]>(Array(5).fill(null));
  const [settings, setSettings] = useState<PenaltySettings>({
    dotSize: 30,
    dotGap: 12,
    teamGap: 80,
    layout: 'side-by-side'
  });

  useEffect(() => {
    const channel = new BroadcastChannel('penalty_channel');

    channel.onmessage = (e) => {
      const { type, data } = e.data;
      if (type !== 'update') return;

      const { shotsA: newShotsA, shotsB: newShotsB, settings: newSettings } = data;
      if (newShotsA) setShotsA(newShotsA);
      if (newShotsB) setShotsB(newShotsB);
      if (newSettings) setSettings(newSettings);
    };

    return () => {
      channel.close();
    };
  }, []);

  const renderDots = (teamShots: (boolean | null)[]) => {
    return (
      <div
        style={{
          display: 'flex',
          gap: `${settings.dotGap}px`,
          flexDirection: 'row'
        }}
      >
        {teamShots.map((shot, idx) => {
          let bg = 'transparent';
          let border = '2px solid #666';
          let opacity = 0.4;
          if (shot === true) {
            bg = 'limegreen';
            border = '2px solid limegreen';
            opacity = 1;
          } else if (shot === false) {
            bg = 'crimson';
            border = '2px solid crimson';
            opacity = 1;
          }

          return (
            <div
              key={idx}
              style={{
                width: `${settings.dotSize}px`,
                height: `${settings.dotSize}px`,
                borderRadius: '50%',
                background: bg,
                border: border,
                opacity: opacity,
                transition: 'background-color 0.1s ease, opacity 0.1s ease'
              }}
            />
          );
        })}
      </div>
    );
  };

  const layoutDirection = settings.layout === 'top-bottom' ? 'column' : 'row';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: layoutDirection as any,
        gap: `${settings.teamGap}px`,
        padding: '12px',
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        background: 'transparent',
        overflow: 'hidden'
      }}
    >
      {renderDots(shotsA)}
      {renderDots(shotsB)}
    </div>
  );
}
