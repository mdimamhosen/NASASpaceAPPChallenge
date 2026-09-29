import type { RoutesService } from '../../routes/routes.service';
import type { RouteWaypoint } from '@mars-explorer/shared';

export async function analyzeRouteTool(routes: RoutesService, waypoints: RouteWaypoint[]) {
  if (waypoints.length < 2) return { error: 'Need at least two waypoints.' };
  return routes.analyze(waypoints);
}
