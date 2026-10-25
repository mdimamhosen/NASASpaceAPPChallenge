import { BadRequestException, Injectable } from '@nestjs/common';
import type { RiskComponent, RouteAnalysis, RouteWaypoint, SuggestedRoute } from '@mars-explorer/shared';
import { RegionsService } from '../regions/regions.service';
import { OpenDataService } from '../opendata/opendata.service';
import { DtmService } from './dtm.service';
import { haversineKm, pointSegmentDistanceKm } from './geo/haversine';

@Injectable()
export class RoutesService {
  constructor(private readonly dtm: DtmService, private readonly regions: RegionsService, private readonly openData: OpenDataService) {}
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
    const components: RiskComponent[] = [
      {id:'slope',label:'Peak sampled grid slope',score:slopeScore,source:method==='dtm-sample'?this.dtm.sourceUrl:'Outside sampled DTM coverage; no slope claim',formula:'min(38, round(maxSlope° × 2.5))',inputs:{maxSlopeDeg:Number(maxSlope.toFixed(2)),method}},
      {id:'distance',label:'Traverse length',score:lengthScore,source:'Waypoint great-circle distance; Mars mean radius 3390 km',formula:'min(22, round(distanceKm × 3))',inputs:{distanceKm:Number(distanceKm.toFixed(3)),marsRadiusKm:3390}},
      {id:'turns',label:'Route complexity',score:turnsScore,source:'Application heuristic: interior waypoint count',formula:'min(12, max(0, waypoints − 2) × 2)',inputs:{waypoints:waypoints.length,interior:Math.max(0,waypoints.length-2)}},
      {id:'coverage',label:'Missing DTM coverage',score:gapScore,source:this.dtm.sourceUrl,formula:'round((1 − coverage) × 45)',inputs:{coverage:Number(coverage.toFixed(3)),gapScore}},
    ];
    const total=Math.min(100,components.reduce((n,c)=>n+c.score,0));
    const riskNotes=[`${Math.round(coverage*100)}% of route samples within the coarse NASA PLACES orbital DTM grid.`,method==='dtm-sample'?`Peak sampled grid slope ${maxSlope.toFixed(1)}°. The grid is ~118 m spacing and cannot resolve local hazards.`:'DTM coverage is incomplete; slope has not been assessed for the full route.','Risk Index weights are application heuristics. NON-CERTIFYING; not an EVA safety assessment.'];
    const startElevation=this.dtm.sample(waypoints[0]);
    const endElevation=this.dtm.sample(waypoints.at(-1)!);
    const region=await this.regions.getJezero();
    const nearbyPois=region.pois.filter((poi)=>waypoints.slice(1).some((point,i)=>pointSegmentDistanceKm(poi,waypoints[i],point)<=0.5));
    // NASA Open Data context is additive: a missing snapshot must never break route analysis.
    const openData=await this.openData.routeContext(waypoints).catch(()=>undefined);
    if (openData?.hiriseDtms.length) riskNotes.push(`HiRISE DTM ${openData.hiriseDtms[0].id} (${openData.hiriseDtms[0].scaleM.toFixed(0)} m posts) covers ${Math.round(openData.hiriseDtms[0].coveredShare*100)}% of this route; finer elevation exists but is not sampled here.`);
    return {openData,distanceKm:Number(distanceKm.toFixed(2)),riskScore:total,riskNotes,nearbyPois,terrainMethod:method,riskIndex:{total,components,method,certifying:false},terrainSamples:samples,dtmCoverage:Number(coverage.toFixed(3)),elevationDeltaM:method==='dtm-sample' && startElevation && endElevation ? Number((endElevation.elevationM-startElevation.elevationM).toFixed(1)):undefined};
  }
  dtmGrid() { return this.dtm.publicGrid(); }
  /** DEM elevation in metres at a point, or null outside the sampled grid. */
  elevationAt(lat: number, lon: number) { return this.dtm.sample({ lat, lon })?.elevationM ?? null; }

  suggest(waypoints: RouteWaypoint[]): SuggestedRoute {
    if (waypoints.length!==2) throw new BadRequestException('Suggested corridor needs exactly two endpoints.');
    const path=this.dtm.suggest(waypoints[0],waypoints[1]);
    if(!path) throw new BadRequestException('No corridor is available within the sampled DTM grid for these endpoints.');
    return {
      waypoints:path,
      method:'dtm-grid-astar',
      sourceUrl:this.dtm.sourceUrl,
      certifying:false,
      note:'Coarse DTM grid A* uses slope-weighted distance. NON-CERTIFYING; inspect original imagery and mission data.',
      costLegend:[
        {id:'step',label:'Step length',detail:'hypot(Δrow, Δcol) on the ~118 m PLACES DEM grid'},
        {id:'slope',label:'Slope weight',detail:'× (1 + min(12°, slope) / 8) — steeper cells cost more'},
        {id:'heuristic',label:'A* heuristic',detail:'Euclidean cell distance to the goal (admissible under unit step)'},
        {id:'coverage',label:'Coverage gate',detail:'Endpoints and cells must sample inside the DEM grid; gaps block the corridor'},
      ],
    };
  }
}
