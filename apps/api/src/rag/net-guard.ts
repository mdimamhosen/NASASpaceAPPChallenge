import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** True for loopback, private, link-local, CGNAT, multicast, metadata and unspecified addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}

/** SSRF guard: http(s) only, and every resolved address must be public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs can be ingested.');
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('Local hosts cannot be ingested.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('That host resolves to a private or reserved address.');
  return url;
}

/**
 * Fetch with manual redirects so each hop is re-validated, a byte cap, and a timeout.
 * ponytail: DNS can still change between lookup and connect (rebinding); pin the resolved IP via a custom agent if this endpoint is ever exposed publicly.
 */
export async function guardedFetch(raw: string, maxBytes = 2_000_000, timeoutMs = 45_000): Promise<{ url: string; contentType: string; body: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'MarsExplorer-RAG/1.0 (+research console)', accept: 'text/html,text/plain,text/markdown;q=0.9,*/*;q=0.1' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString()); continue; }
    if (!res.ok) throw new Error(`Fetch failed with HTTP ${res.status}.`);
    const reader = res.body?.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Document exceeds the 2 MB ingest limit.'); }
      parts.push(value);
    }
    return { url: url.toString(), contentType: res.headers.get('content-type') ?? '', body: Buffer.concat(parts).toString('utf8') };
  }
  throw new Error('Too many redirects.');
}
