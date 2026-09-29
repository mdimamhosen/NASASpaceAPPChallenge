import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { MapLayer } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

@Injectable()
export class LayersService {
  constructor(private readonly dataPath: DataPathService) {}

  async getLayers(): Promise<MapLayer[]> {
    return JSON.parse(await readFile(this.dataPath.resolve('layers.json'), 'utf8')) as MapLayer[];
  }
}
