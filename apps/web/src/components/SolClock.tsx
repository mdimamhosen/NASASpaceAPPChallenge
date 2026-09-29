'use client';

import { useEffect, useState } from 'react';

export default function SolClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const julianDate = Date.now() / 86_400_000 + 2_440_587.5;
      const marsSolDate = (julianDate - 2_405_522.0028779) / 1.0274912517;
      const localMeanSolarTime = ((24 * marsSolDate) % 24 + 24) % 24;
      const hour = Math.floor(localMeanSolarTime).toString().padStart(2, '0');
      const minute = Math.floor((localMeanSolarTime * 60) % 60).toString().padStart(2, '0');
      setTime(`MSD ${marsSolDate.toFixed(1)} · ${hour}:${minute} LMST`);
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="sol-clock" title="Mars Sol Date and local mean solar time approximation">{time || 'MARS TIME …'}</span>;
}
