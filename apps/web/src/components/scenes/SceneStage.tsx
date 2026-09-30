'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

export type SceneKind = 'solar' | 'mars' | 'mars-hero' | 'terrain' | 'layers' | 'sample' | 'earth' | 'ops' | 'architecture';
export type EarthScenePoint = { lat: number; lon: number; categoryId: string };
const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false });
const titles: Record<SceneKind, string> = {
  solar: 'EARTH → MARS / TRANSFER CONCEPT',
  mars: 'MARS / NASA VIKING GLOBAL TEXTURE',
  'mars-hero': 'MARS / NASA VIKING GLOBAL TEXTURE · ORBITAL VIEW',
  terrain: 'MARS SURFACE / ILLUSTRATIVE TERRAIN STUDY · NOT NAVIGATION DATA',
  layers: 'MARS DATA / ILLUSTRATIVE LAYER STACK · NOT A MEASURED TERRAIN MODEL',
  sample: 'MARS GEOLOGY / ILLUSTRATIVE ROCK FORM · NOT A COLLECTED SAMPLE',
  earth: 'EARTH / NASA BLUE MARBLE REFERENCE',
  ops: 'SIMULATED / RELAY VIGNETTE',
  architecture: 'WEB / API / SHARED / DATA',
};

export default function SceneStage({
  kind,
  className = '',
  earthPoints = [],
  permanent = false,
  keepPoster = false,
}: {
  kind: SceneKind;
  className?: string;
  earthPoints?: EarthScenePoint[];
  /** Once eligible, never unmount the canvas when scrolled away. */
  permanent?: boolean;
  /** Keep the cinematic orb/poster visible (hero look from the product shot). */
  keepPoster?: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(permanent);
  const [canRender, setCanRender] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const check = () => {
      if (reduced.matches) {
        setCanRender(false);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        setCanRender(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')));
      } catch {
        setCanRender(false);
      }
    };
    check();
    reduced.addEventListener('change', check);

    if (permanent) {
      setVisible(true);
      return () => reduced.removeEventListener('change', check);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
        else if (!armed) setVisible(false);
      },
      { rootMargin: '200px' },
    );
    if (node.current) observer.observe(node.current);
    return () => {
      observer.disconnect();
      reduced.removeEventListener('change', check);
    };
  }, [permanent, armed]);

  useEffect(() => {
    if (visible && canRender) setArmed(true);
  }, [visible, canRender]);

  const live = canRender && (permanent || visible || armed);
  /** The poster remains visible for motion or WebGL fallbacks. */
  const showCanvas = live && !keepPoster;
  return (
    <div
      ref={node}
      className={`scene-stage scene-${kind} ${live || keepPoster ? 'scene-live' : ''} ${keepPoster ? 'scene-keep-poster' : ''} ${className}`}
      role="img"
      aria-label={kind === 'earth' && earthPoints.length ? 'EARTH / NASA BLUE MARBLE WITH LIVE EONET EVENT POINTS' : titles[kind]}
    >
      <div className="scene-poster" aria-hidden="true">
        <span className="poster-orbit" />
        <span className="poster-core" />
        <span className="poster-marker" />
      </div>
      {showCanvas && <SceneCanvas kind={kind} earthPoints={earthPoints} />}
      <span className="scene-caption">{kind === 'earth' && earthPoints.length ? 'EARTH / NASA BLUE MARBLE · LIVE EONET POINTS' : titles[kind]}</span>
      {(kind === 'mars' || kind === 'mars-hero') && (
        <a className="scene-credit" href="https://science.nasa.gov/3d-resources/mars/" target="_blank" rel="noreferrer">
          TEXTURE / NASA JPL-CALTECH ↗
        </a>
      )}
      {kind === 'earth' && <a className="scene-credit" href="https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg" target="_blank" rel="noreferrer">TEXTURE / NASA BLUE MARBLE ↗</a>}
    </div>
  );
}
