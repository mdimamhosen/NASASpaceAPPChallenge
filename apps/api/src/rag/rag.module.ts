import { Module } from '@nestjs/common';
import { CorpusLoaderService } from './corpus-loader.service';
import { RetrieverService } from './retriever.service';

@Module({ providers: [CorpusLoaderService, RetrieverService], exports: [CorpusLoaderService, RetrieverService] })
export class RagModule {}
