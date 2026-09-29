import { Injectable } from '@nestjs/common';
import type { RouteWaypoint } from '@mars-explorer/shared';
import { AssistantService } from '../agent/assistant.service';

@Injectable()
export class BriefingsService {
  constructor(private readonly assistant: AssistantService) {}

  create(waypoints: RouteWaypoint[]) {
    return this.assistant.briefing(waypoints);
  }
}
