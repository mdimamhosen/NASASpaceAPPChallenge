import { Injectable } from '@nestjs/common';
import { CorpusLoaderService, type CorpusDoc } from './corpus-loader.service';

@Injectable()
export class RetrieverService {
  constructor(private readonly corpus: CorpusLoaderService) {}

  async retrieve(question: string, limit = 3): Promise<CorpusDoc[]> {
    const docs = await this.corpus.loadAll();
    const terms = new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
    return docs
      .map((doc) => {
        const score = [...terms].reduce((sum, term) => sum + (doc.body.toLowerCase().includes(term) ? 1 : 0), 0);
        return { score, doc };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.doc);
  }
}
