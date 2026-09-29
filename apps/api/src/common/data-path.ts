import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class DataPathService {
  constructor(private readonly config: ConfigService) {}

  root(): string {
    return this.config.get<AppConfig['dataDir']>('dataDir') || join(process.cwd(), '../../data');
  }

  resolve(...parts: string[]): string {
    return join(this.root(), ...parts);
  }
}
