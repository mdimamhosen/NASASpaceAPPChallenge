export type SiteSearchHit = { id: string; label: string; href: string; kind: 'page' | 'product' | 'command'; blurb: string };

const INDEX: SiteSearchHit[] = [
  { id: 'explore', label: 'Explore console', href: '/explore', kind: 'page', blurb: 'Mars Trek Marswalk Risk Index' },
  { id: 'classroom', label: 'Classroom pack', href: '/classroom', kind: 'page', blurb: 'STEM lesson worksheet' },
  { id: 'science', label: 'Science & methods', href: '/science', kind: 'page', blurb: 'NASA product register reproduce' },
  { id: 'research', label: 'Research console', href: '/research', kind: 'page', blurb: 'RAG mission agent' },
  { id: 'eonet', label: 'Earth EONET', href: '/eonet', kind: 'page', blurb: 'Earth natural events' },
  { id: 'opendata', label: 'Open Data', href: '/opendata', kind: 'page', blurb: 'data.nasa.gov catalog' },
  { id: 'survival', label: 'Survival tour', href: '/survival', kind: 'page', blurb: 'Demo tour start' },
  { id: 'pipeline', label: 'Pipeline', href: '/pipeline', kind: 'page', blurb: 'RAG eval honesty board' },
  { id: 'analog', label: 'Earth analog', href: '/analog', kind: 'page', blurb: 'Analogy not transfer' },
  { id: 'places', label: 'NASA PLACES', href: '/explore', kind: 'product', blurb: 'Perseverance localizations best_interp' },
  { id: 'dem', label: 'PLACES orbital DEM', href: '/science#reproduce', kind: 'product', blurb: 'Elevation slope Risk Index' },
  { id: 'trek', label: 'NASA Mars Trek', href: '/explore', kind: 'product', blurb: 'MOLA Viking HRSC HiRISE' },
  { id: 'hirise', label: 'HiRISE DTM', href: '/opendata', kind: 'product', blurb: 'Footprints route coverage' },
  { id: 'raw', label: 'Mars 2020 raw images', href: '/explore', kind: 'product', blurb: 'Sol camera strip RSS' },
  { id: 'gibs', label: 'NASA GIBS Earth imagery', href: '/eonet', kind: 'product', blurb: 'Earth basemap not Mars' },
  { id: 'eonet-prod', label: 'NASA EONET v3', href: '/eonet', kind: 'product', blurb: 'EARTH natural events only' },
  { id: 'jpl', label: 'JPL approximate positions', href: '/science#reproduce', kind: 'product', blurb: 'Light-time AU orbits' },
  { id: 'iau', label: 'IAU feature names', href: '/explore', kind: 'product', blurb: 'Gazetteer layer' },
  { id: 'risk', label: 'Traverse Risk Index', href: '/explore', kind: 'command', blurb: 'Non-certifying score components' },
  { id: 'cmd-classroom', label: 'Voice: classroom mode', href: '/explore', kind: 'command', blurb: 'Say classroom mode' },
  { id: 'cmd-sol', label: 'Voice: sol scrub', href: '/explore', kind: 'command', blurb: 'Say sol 420' },
  { id: 'cmd-risk', label: 'Voice: read risk', href: '/explore', kind: 'command', blurb: 'Say read risk' },
  { id: 'reproduce', label: 'Science reproduce panel', href: '/science#reproduce', kind: 'page', blurb: 'pnpm refresh:nasa refresh:opendata' },
];

/** Instant substring rank — no network. */
export function searchSite(query: string, limit = 12): SiteSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDEX.slice(0, limit);
  const scored = INDEX.map((hit) => {
    const hay = `${hit.label} ${hit.blurb} ${hit.href}`.toLowerCase();
    let score = 0;
    if (hay.startsWith(q)) score += 40;
    if (hit.label.toLowerCase().includes(q)) score += 30;
    if (hay.includes(q)) score += 15;
    for (const part of q.split(/\s+/)) if (part && hay.includes(part)) score += 5;
    return { hit, score };
  }).filter((row) => row.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.hit);
}
