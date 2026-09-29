'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

export type SceneKind = 'solar' | 'mars' | 'ops' | 'architecture';
const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false });
const titles: Record<SceneKind, string> = {
  solar: 'EARTH → MARS / TRANSFER CONCEPT',
  mars: 'MARS / NASA VIKING GLOBAL TEXTURE',
  ops: 'SIMULATED / RELAY VIGNETTE',
  architecture: 'WEB / API / SHARED / DATA',
};

export default function SceneStage({ kind, className = '' }: { kind: SceneKind; className?: string }) {
  const node = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [canRender, setCanRender] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const check = () => {
      if (reduced.matches) { setCanRender(false); return; }
      try { const canvas = document.createElement('canvas'); setCanRender(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))); }
      catch { setCanRender(false); }
    };
    check(); reduced.addEventListener('change', check);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '150px' });
    if (node.current) observer.observe(node.current);
    return () => { observer.disconnect(); reduced.removeEventListener('change', check); };
  }, []);
  const live = canRender && visible;
  return <div ref={node} className={`scene-stage scene-${kind} ${live ? 'scene-live' : ''} ${className}`} role="img" aria-label={titles[kind]}>
    <div className="scene-poster" aria-hidden="true"><span className="poster-orbit" /><span className="poster-core" /><span className="poster-marker" /></div>
    {live && <SceneCanvas kind={kind} />}
    <span className="scene-caption">{titles[kind]}</span>
    {kind === 'mars' && <a className="scene-credit" href="https://science.nasa.gov/3d-resources/mars/" target="_blank" rel="noreferrer">TEXTURE / NASA JPL-CALTECH ↗</a>}
  </div>;
}
