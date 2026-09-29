'use client';
import LongFormExtras from './LongFormExtras';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Printer } from 'lucide-react';
import type { MissionBriefing, RouteWaypoint } from '@mars-explorer/shared';
import { createBriefing, downloadBriefingPdf } from '@/lib/api';
import MissionNav from './MissionNav';

const waypoints: RouteWaypoint[] = [
  { id: 'brief-1', lat: 18.435, lon: 77.405 }, { id: 'brief-2', lat: 18.445, lon: 77.435 },
  { id: 'brief-3', lat: 18.455, lon: 77.465 }, { id: 'brief-4', lat: 18.445, lon: 77.495 },
];

export default function BriefingPreview() {
  const [briefing, setBriefing] = useState<MissionBriefing | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { createBriefing(waypoints).then(setBriefing).catch((reason: Error) => setError(reason.message)); }, []);
  return <main className="theater-page briefing-theater"><MissionNav active="/briefing/preview" /><section className="briefing-sheet"><header><div><p className="eyebrow">MISSION NOTE / JEZERO · DEMONSTRATION ROUTE</p><h1>{briefing?.title ?? 'Traverse briefing'}</h1></div><button onClick={() => void downloadBriefingPdf(waypoints).catch((reason: Error) => setError(reason.message))}><Printer size={15} /> DOWNLOAD SERVER PDF</button></header>{error && briefing && <p className="theater-error" role="status">{error}</p>}{briefing ? <><div className="briefing-facts"><span>DISTANCE<strong>{briefing.distanceKm.toFixed(2)} KM</strong></span><span>WAYPOINTS<strong>{briefing.explorationPoints}</strong></span><span>STATUS<strong>PLANNING CONCEPT</strong></span></div>{[['SCIENTIFIC OBJECTIVES', briefing.scientificObjectives], ['TERRAIN CONSIDERATIONS', briefing.terrainConsiderations], ['NEARBY CONTEXT', briefing.recommendedInvestigationPoints]].map(([title, values]) => <section className="briefing-chapter" key={title as string}><h2>{title as string}</h2>{(values as string[]).length ? (values as string[]).map((value) => <p key={value}>{value}</p>) : <p>No seeded science points fall within the route context radius.</p>}</section>)}<section className="briefing-chapter"><h2>SOURCE REGISTER</h2>{briefing.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title}<ArrowUpRight size={13} /></a>)}</section></> : <p className="theater-error">{error || 'Retrieving briefing…'}</p>}<footer>Planning aid only · heuristic terrain context is non-certifying · not for operational navigation</footer></section><Link className="brief-back-link" href="/explore">RETURN TO CONSOLE <ArrowUpRight size={14} /></Link><LongFormExtras page="briefing" /></main>;
}
