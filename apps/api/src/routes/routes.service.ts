import { BadRequestException, Injectable } from '@nestjs/common';
import type { RouteAnalysis, RouteWaypoint, SuggestedRoute } from '@mars-explorer/shared';
import { RegionsService } from '../regions/regions.service';
import { DtmService } from './dtm.service';
import { haversineKm, pointSegmentDistanceKm } from './geo/haversine';

@Injectable()
export class RoutesService {
  constructor(private readonly dtm: DtmService, private readonly regions: RegionsService) {}
  async analyze(waypoints: RouteWaypoint[]): Promise<RouteAnalysis> {
    if (waypoints.length < 2 || waypoints.length > 100) throw new BadRequestException('A route needs 2–100 waypoints.');
    if (waypoints.some((p)=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat < -90||p.lat > 90||p.lon < -180||p.lon > 180)) throw new BadRequestException('Invalid Mars coordinate.');
    const distanceKm=waypoints.slice(1).reduce((sum,p,i)=>sum+haversineKm(waypoints[i],p),0);
    const {samples,coverage}=this.dtm.sampleRoute(waypoints);
    const method=coverage>=.8 ? 'dtm-sample' : 'heuristic';
    const maxSlope=samples.length?Math.max(...samples.map((p)=>p.slopeDeg??0)):0;
    const slopeScore=method==='dtm-sample'?Math.min(38,Math.round(maxSlope*2.5)):0;
    const lengthScore=Math.min(22,Math.round(distanceKm*3));
    const turnsScore=Math.min(12,Math.max(0,waypoints.length-2)*2);
    const gapScore=Math.round((1-coverage)*45);
    const components=[
      {id:'slope',label:'Peak sampled grid slope',score:slopeScore,source:method==='dtm-sample'?this.dtm.sourceUrl:'Outside sampled DTM coverage; no slope claim'},
      {id:'distance',label:'Traverse length',score:lengthScore,source:'Waypoint great-circle distance; Mars mean radius 3390 km'},
      {id:'turns',label:'Route complexity',score:turnsScore,source:'Application heuristic: interior waypoint count'},
      {id:'coverage',label:'Missing DTM coverage',score:gapScore,source:this.dtm.sourceUrl},
    ];
    const total=Math.min(100,components.reduce((n,c)=>n+c.score,0));
    const riskNotes=[`${Math.round(coverage*100)}% of route samples within the coarse NASA PLACES orbital DTM grid.`,method==='dtm-sample'?`Peak sampled grid slope ${maxSlope.toFixed(1)}°. The grid is ~118 m spacing and cannot resolve local hazards.`:'DTM coverage is incomplete; slope has not been assessed for the full route.','Risk Index weights are application heuristics. NON-CERTIFYING; not an EVA safety assessment.'];
    const startElevation=this.dtm.sample(waypoints[0]);
    const endElevation=this.dtm.sample(waypoints.at(-1)!);
    const region=await this.regions.getJezero();
    const nearbyPois=region.pois.filter((poi)=>waypoints.slice(1).some((point,i)=>pointSegmentDistanceKm(poi,waypoints[i],point)<=0.5));
    return {distanceKm:Number(distanceKm.toFixed(2)),riskScore:total,riskNotes,nearbyPois,terrainMethod:method,riskIndex:{total,components,method,certifying:false},terrainSamples:samples,dtmCoverage:Number(coverage.toFixed(3)),elevationDeltaM:method==='dtm-sample' && startElevation && endElevation ? Number((endElevation.elevationM-startElevation.elevationM).toFixed(1)):undefined};
  }
  dtmGrid() { return this.dtm.publicGrid(); }

  suggest(waypoints: RouteWaypoint[]): SuggestedRoute {
    if (waypoints.length!==2) throw new BadRequestException('Suggested corridor needs exactly two endpoints.');
    const path=this.dtm.suggest(waypoints[0],waypoints[1]);
    if(!path) throw new BadRequestException('No corridor is available within the sampled DTM grid for these endpoints.');
    return {waypoints:path,method:'dtm-grid-astar',sourceUrl:this.dtm.sourceUrl,certifying:false,note:'Coarse DTM grid A* uses slope-weighted distance. NON-CERTIFYING; inspect original imagery and mission data.'};
  }
}
