import { Injectable } from '@nestjs/common';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Citation } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

export type CorpusDoc = Citation & { body: string };

@Injectable()
export class CorpusLoaderService {
  constructor(private readonly dataPath: DataPathService) {}

  async loadAll(): Promise<CorpusDoc[]> {
    const corpusPath = this.dataPath.resolve('corpus');
    const files = (await readdir(corpusPath)).filter((file) => file.endsWith('.md'));
    return Promise.all(
      files.map(async (file) => {
        const raw = await readFile(join(corpusPath, file), 'utf8');
        const title = raw.match(/^title:\s*(.+)$/m)?.[1] ?? file;
        const url = raw.match(/^url:\s*(.+)$/m)?.[1] ?? '';
        const mission = raw.match(/^mission:\s*(.+)$/m)?.[1];
        const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
        return { title, url, mission, excerpt: body.slice(0, 300), body };
      }),
    );
  }
}
