import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RagDocument } from '@mars-explorer/shared';
import { CorpusLoaderService } from './corpus-loader.service';
import { RagIndexService } from './index.service';
import { guardedFetch } from './net-guard';
import { htmlToText, slugify } from './text';

@Injectable()
export class IngestService {
  constructor(private readonly corpus: CorpusLoaderService, private readonly index: RagIndexService) {}

  private async write(title: string, body: string, url: string, source: 'curated' | 'user'): Promise<RagDocument> {
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < 60) throw new BadRequestException(`Only ${words} words of readable text; at least 60 are needed to index a document.`);
    const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
    // Re-ingesting the same URL refreshes that file instead of duplicating it.
    // Only files the ingester created (nasa-*/user-*) are refreshed; hand-written notes are never overwritten.
    const existing = url ? (await this.corpus.loadAll()).find((d) => d.url === url && /^(nasa|user)-/.test(d.file)) : undefined;
    if (existing && existing.source !== source && existing.source === 'curated') throw new BadRequestException('That URL is already in the curated corpus.');
    const prefix = source === 'curated' ? 'nasa' : 'user', base = slugify(title).replace(/^nasa-/, '');
    let file = existing?.file ?? `${prefix}-${base}.md`;
    if (!existing) {
      const files = new Set(await readdir(this.corpus.dir));
      for (let i = 2; files.has(file); i++) file = `${prefix}-${base}-${i}.md`;
    }
    const front = ['---', `title: ${clean(title)}`, `url: ${clean(url)}`, `source: ${source}`, `retrievedDate: ${new Date().toISOString().slice(0, 10)}`, '---', ''].join('\n');
    await writeFile(join(this.corpus.dir, file), `${front}\n${body.trim()}\n`);
    const st = await this.index.rebuild();
    return st.documents.find((d) => d.id === file.replace(/\.md$/, ''))!;
  }

  async addUrl(url: string, source: 'curated' | 'user' = 'user', titleOverride?: string): Promise<RagDocument> {
    let page: Awaited<ReturnType<typeof guardedFetch>>;
    try { page = await guardedFetch(url); } catch (error) { throw new BadRequestException((error as Error).message); }
    const isHtml = /html/i.test(page.contentType) || /^\s*<(!doctype|html)/i.test(page.body);
    if (!isHtml && !/text\/(plain|markdown)/i.test(page.contentType)) throw new BadRequestException(`Unsupported content type: ${page.contentType || 'unknown'}.`);
    const { title, markdown } = isHtml ? htmlToText(page.body) : { title: '', markdown: page.body };
    return this.write(titleOverride || title || new URL(page.url).pathname.split('/').filter(Boolean).pop() || new URL(page.url).hostname, markdown, page.url, source);
  }

  addText(title: string, body: string, url = ''): Promise<RagDocument> {
    return this.write(title, body, url, 'user');
  }

  async remove(id: string): Promise<{ removed: string }> {
    if (!/^[a-z0-9-]+$/i.test(id)) throw new BadRequestException('Invalid document id.');
    const file = join(this.corpus.dir, `${id}.md`);
    const raw = await readFile(file, 'utf8').catch(() => { throw new NotFoundException('Document not found.'); });
    if (!/^source:\s*user$/m.test(raw)) throw new ForbiddenException('Only user-added documents can be deleted.');
    await unlink(file);
    await this.index.rebuild();
    return { removed: id };
  }
}
