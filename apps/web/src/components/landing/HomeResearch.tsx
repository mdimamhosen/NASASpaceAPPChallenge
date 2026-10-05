'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const ResearchConsole = dynamic(() => import('../ResearchConsole'), { ssr: false, loading: () => <div className="map-loading">LOADING RESEARCH CONSOLE…</div> });

/** Mounts the full research console only when it nears the viewport, so the home page's first paint stays light. */
export default function HomeResearch() {
  const node = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={node} id="ask" className="home-research">{visible ? <ResearchConsole variant="embedded" /> : <div className="map-loading">ASK THE MISSION</div>}</div>;
}
