import { Global, Module } from '@nestjs/common';
import { DataPathService } from './data-path';

@Global()
@Module({ providers: [DataPathService], exports: [DataPathService] })
export class CommonModule {}
