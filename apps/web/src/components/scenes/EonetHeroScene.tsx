'use client';
import { useEffect, useState } from 'react';
import { getEarthEventSummaries } from '@/lib/api';
import SceneStage, { type EarthScenePoint } from './SceneStage';

export default function EonetHeroScene() {
  const [points, setPoints] = useState<EarthScenePoint[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = () => getEarthEventSummaries(30).then((events) => { if (active) setPoints(events.filter((event) => event.lat != null && event.lon != null).map((event) => ({ lat: event.lat!, lon: event.lon!, categoryId: event.categoryId }))); }).catch(() => {});
    void refresh(); const interval = window.setInterval(refresh, 75_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return <SceneStage kind="earth" className="eonet-scene" earthPoints={points} />;
}
