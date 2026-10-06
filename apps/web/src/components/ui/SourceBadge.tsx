import type { SourceLabel } from '@mars-explorer/shared';

const TITLE: Record<SourceLabel, string> = {
  live: 'Fetched from the NASA source just now',
  cache: 'Served from the local cache written on an earlier live fetch',
  fixture: 'Served from a committed demo fixture',
  snapshot: 'Served from the committed, checksummed snapshot',
  offline: 'OFFLINE=1: no upstream calls, cloud models off',
};

/** Where a value came from, said plainly next to it. */
export default function SourceBadge({ source, at }: { source: SourceLabel; at?: string }) {
  return <span className={`source-badge src-${source}`} title={`${TITLE[source]}${at ? ` · ${at}` : ''}`}>{source.toUpperCase()}</span>;
}
