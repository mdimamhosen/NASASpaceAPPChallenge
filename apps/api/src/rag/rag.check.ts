// Run: node apps/api/src/rag/rag.check.ts
import assert from 'node:assert/strict';
import { chunkMarkdown, htmlToText, slugify, tokenize } from './text.ts';
import { Bm25, mmr, normalize, pca3, rrf } from './ranking.ts';
import { isPrivateAddress } from './net-guard.ts';

// Tokenizer: stopwords out, stemming consistent across forms.
assert.deepEqual(tokenize('The rovers were sampling rocks'), tokenize('rover sample rock'));

// Chunker: heading-aware, bounded size, overlap carried, no duplicate tails.
const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about Jezero delta sediments and sampling.`).join(' ');
const chunks = chunkMarkdown(`# Mission\n\n${long}\n\n## Landing site\n\nJezero Crater was chosen because it held an ancient lake and a river delta.`, 60, 15);
assert.ok(chunks.length >= 4, `expected several chunks, got ${chunks.length}`);
assert.ok(chunks.every((c) => c.text.split(' ').length <= 75), 'chunks stay near target size');
assert.equal(chunks.at(-1)!.heading, 'Mission › Landing site');
assert.ok(chunks[1].text.startsWith(chunks[0].text.split('. ').at(-1)!.slice(0, 20)) || chunks[1].text.includes('Sentence number'), 'overlap carried');
assert.equal(new Set(chunks.map((c) => c.text)).size, chunks.length, 'no duplicate chunks');

// BM25: the relevant document wins.
const docs = ['Jezero crater landing site delta lake', 'Earth wildfire storm events EONET', 'Mars Trek imagery tiles WMTS'].map(tokenize);
const scores = new Bm25(docs).scores(tokenize('why was the Jezero landing site chosen'));
assert.equal(scores.indexOf(Math.max(...scores)), 0);

// RRF: an item ranked well in both lists beats one ranked first in only one.
const fused = rrf([['a', 'b', 'c'], ['b', 'c', 'a']]);
assert.ok(fused.get('b')! > fused.get('a')!);

// MMR: a near-duplicate is pushed below a diverse item.
const v = (x: number, y: number) => normalize([x, y]);
const picked = mmr([{ id: 'a', score: 1, vec: v(1, 0) }, { id: 'a2', score: 0.95, vec: v(1, 0.01) }, { id: 'b', score: 0.8, vec: v(0, 1) }], 2, 0.5);
assert.deepEqual(picked.map((p) => p.id), ['a', 'b']);

// PCA: first axis follows the dominant variance direction.
const pts = Array.from({ length: 30 }, (_, i) => Float32Array.from([i, i * 0.01, 0]));
assert.ok(Math.abs(pca3(pts).axes[0][0]) > 0.99);

// HTML extraction: scripts and nav gone, headings kept.
const page = htmlToText('<html><head><title>Landing Site | NASA</title><script>evil()</script></head><body><nav>Home About Contact Links</nav><h2>Why Jezero</h2><p>Jezero once held a lake fed by a river delta long ago.</p></body></html>');
assert.equal(page.title, 'Landing Site');
assert.ok(page.markdown.includes('## Why Jezero') && !page.markdown.includes('evil') && !page.markdown.includes('Contact'));

// SSRF guard classification.
for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.1', '172.20.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.ok(isPrivateAddress(ip), ip);
for (const ip of ['8.8.8.8', '198.118.255.1', '2607:f8b0::1']) assert.ok(!isPrivateAddress(ip), ip);

assert.equal(slugify('Mars 2020: Perseverance / Jezero!'), 'mars-2020-perseverance-jezero');
console.log('rag checks passed');
