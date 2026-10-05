/** Pure text utilities for the RAG pipeline: tokenizing, chunking, HTML extraction. */

const STOP = new Set(
  ('a an and are as at be but by for from has have how in is it its of on or that the this to was were what when where which who why will with ' +
    'does do did can could would should about into than then there these those their them they we you your our i me my not no if so such also ' +
    'more most may might been being over under between both each other only same very just here use used using one two').split(' '),
);
const SUFFIXES = ['ational', 'ization', 'ations', 'ation', 'ingly', 'ments', 'ment', 'ness', 'ings', 'ing', 'edly', 'ions', 'ion', 'ers', 'er', 'ed', 'ly', 'es', 's'];

/** Light suffix stemmer; consistent on index and query sides, which is all BM25 needs. */
export function stem(word: string): string {
  if (word.length <= 4 || /^\d+$/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  let out = word;
  for (const suffix of SUFFIXES) if (word.endsWith(suffix) && word.length - suffix.length >= 3) { out = word.slice(0, -suffix.length); break; }
  // Trailing-e normalization so "sample"/"sampling" and "crater"/"crate" meet.
  return out.length > 4 && out.endsWith('e') ? out.slice(0, -1) : out;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize('NFKD').match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [])
    .map((t) => t.replace(/'s$/, ''))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export function splitSentences(text: string): string[] {
  // Split only where terminal punctuation is followed by a new sentence, so "18.6 miles" stays whole.
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

export type Chunk = { heading: string; text: string };

/**
 * Heading-aware chunking: sections split by markdown headings, then packed sentence by sentence into ~target words,
 * with ~overlap words carried into the next chunk of the same section.
 */
export function chunkMarkdown(markdown: string, target = 180, overlap = 40): Chunk[] {
  const sections: Array<{ heading: string; body: string[] }> = [{ heading: '', body: [] }];
  const stack: string[] = [];
  for (const line of markdown.split('\n')) {
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (h) {
      stack.length = h[1].length - 1;
      stack[h[1].length - 1] = h[2].trim();
      sections.push({ heading: stack.filter(Boolean).join(' › '), body: [] });
    } else sections.at(-1)!.body.push(line);
  }
  const chunks: Chunk[] = [];
  for (const section of sections) {
    const sentences = splitSentences(section.body.join(' ').replace(/^[-*]\s+/gm, ''));
    let current: string[] = [], words = 0, fresh = false;
    const flush = () => {
      if (!current.length) return;
      chunks.push({ heading: section.heading, text: current.join(' ') });
      fresh = false;
      // Carry trailing sentences (~overlap words) forward.
      const carry: string[] = [];
      let carried = 0;
      for (let i = current.length - 1; i >= 0 && carried < overlap; i--) { carry.unshift(current[i]); carried += current[i].split(' ').length; }
      current = carried < words ? carry : [];
      words = current.reduce((n, s) => n + s.split(' ').length, 0);
    };
    for (const sentence of sentences) {
      const n = sentence.split(' ').length;
      if (words + n > target && words > overlap) flush();
      current.push(sentence);
      words += n;
      fresh = true;
    }
    if (current.length && fresh) chunks.push({ heading: section.heading, text: current.join(' ') });
  }
  return chunks.filter((c) => c.text.split(' ').length >= 8);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', deg: '°' };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m));

/** Dependency-free HTML → markdown-ish text: keeps headings, paragraphs, list items; drops chrome and scripts. */
export function htmlToText(html: string): { title: string; markdown: string } {
  const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()).split(/\s+[|–-]\s+/)[0].trim();
  let body = html.replace(/<!--[\s\S]*?-->/g, '');
  const main = /<(main|article)\b[^>]*>([\s\S]*)<\/\1>/i.exec(body);
  if (main && main[2].length > 2000) body = main[2];
  body = body
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|aside|iframe|button|select)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l: string, t: string) => `\n\n${'#'.repeat(Number(l))} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/section|\/table|\/ul|\/ol|\/dd|\/dt)[^>]*>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  const seen = new Set<string>();
  const lines = decode(body)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter((l) => {
      if (!l || seen.has(l)) return false;
      seen.add(l);
      return l.startsWith('#') || l.split(' ').length >= 4;
    });
  return { title, markdown: lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() };
}

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
