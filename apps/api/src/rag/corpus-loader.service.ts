import { Injectable } from '@nestjs/common';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Citation } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

export type CorpusDoc = Citation & { id: string; body: string; source: 'curated' | 'user'; retrievedDate?: string; file: string };

@Injectable()
export class CorpusLoaderService {
  constructor(private readonly dataPath: DataPathService) {}

  get dir() { return this.dataPath.resolve('corpus'); }

  /** Changes whenever a corpus file is added, removed, or edited. */
  async signature(): Promise<string> {
    const files = (await readdir(this.dir)).filter((file) => file.endsWith('.md')).sort();
    const parts = await Promise.all(files.map(async (file) => { const s = await stat(join(this.dir, file)); return `${file}:${s.mtimeMs}:${s.size}`; }));
    return parts.join('|');
  }

  async loadAll(): Promise<CorpusDoc[]> {
    const files = (await readdir(this.dir)).filter((file) => file.endsWith('.md')).sort();
    return Promise.all(
      files.map(async (file) => {
        const raw = await readFile(join(this.dir, file), 'utf8');
        const field = (name: string) => raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();
        const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
        return {
          id: file.replace(/\.md$/, ''),
          file,
          title: field('title') ?? file,
          url: field('url') ?? '',
          mission: field('mission'),
          source: field('source') === 'user' ? 'user' : 'curated',
          retrievedDate: field('retrievedDate'),
          excerpt: body.slice(0, 300),
          body,
        };
      }),
    );
  }
}
