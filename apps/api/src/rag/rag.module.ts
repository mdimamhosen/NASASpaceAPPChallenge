import { Module } from '@nestjs/common';
import { AnswerService } from './answer.service';
import { CorpusLoaderService } from './corpus-loader.service';
import { EmbedderService } from './embedder.service';
import { RagIndexService } from './index.service';
import { IngestService } from './ingest.service';
import { LlmService } from './llm.service';
import { RagController } from './rag.controller';
import { RetrieverService } from './retriever.service';

@Module({
  controllers: [RagController],
  providers: [CorpusLoaderService, EmbedderService, RagIndexService, RetrieverService, LlmService, AnswerService, IngestService],
  exports: [CorpusLoaderService, RetrieverService, LlmService, AnswerService],
})
export class RagModule {}
