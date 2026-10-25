import { Injectable } from '@nestjs/common';
import type { RouteWaypoint } from '@mars-explorer/shared';
import { conjunctionWindows, daylightLtst, dustSeason, evaBudget, marsTime, routeProfile, suitability } from '@mars-explorer/shared';
import { AssistantService } from '../agent/assistant.service';
import { OpenDataService } from '../opendata/opendata.service';
import { PlacesService } from '../places/places.service';
import { RegionsService } from '../regions/regions.service';
import { RoutesService } from '../routes/routes.service';
import { haversineKm } from '../routes/geo/haversine';

export type FieldGuide = Awaited<ReturnType<BriefingsService['fieldGuide']>>;

@Injectable()
export class BriefingsService {
  constructor(
    private readonly assistant: AssistantService,
    private readonly routes: RoutesService,
    private readonly openData: OpenDataService,
    private readonly regions: RegionsService,
    private readonly places: PlacesService,
  ) {}

  create(waypoints: RouteWaypoint[]) {
    return this.assistant.briefing(waypoints);
  }

  /** Survival field-guide extras for the PDF: everything computed by our checked modules from NASA data. NON-CERTIFYING. */
  async fieldGuide(waypoints: RouteWaypoint[], now = new Date()) {
    const start = waypoints[0];
    const [analysis, features, hardware, region, track] = await Promise.all([
      this.routes.analyze(waypoints), this.openData.nearestFeatures(start, 6).catch(() => []), this.openData.hardware().catch(() => []),
      this.regions.getJezero(), this.places.perseverance(),
    ]);
    const t = marsTime(now, start.lon);
    const day = daylightLtst(start.lat, t.declination);
    const dtm = analysis.terrainMethod === 'dtm-sample';
    const eva = evaBudget({ profile: dtm ? routeProfile(analysis.terrainSamples) : [{ km: 0, elevationM: 0 }, { km: analysis.distanceKm, elevationM: 0 }], daylightHours: day?.hours });
    const sites = suitability({ ...this.routes.dtmGrid(), targets: region.pois.filter((p) => p.sourceKind !== 'DEMO' && (p.category === 'geology' || p.category === 'mission')), track: track.points }).best.slice(0, 3);
    return {
      generatedUtc: now.toISOString(), start, time: t, daylight: day, dustSeason: dustSeason(t.ls), eva, evaProfile: dtm ? 'PLACES DEM samples' : 'flat (DEM coverage too low)',
      blackouts: conjunctionWindows(now, new Date(now.getTime() + 3 * 365.25 * 864e5)),
      sites, features: features.slice(0, 6),
      hardware: hardware.map((h) => ({ name: h.name, status: h.status, km: haversineKm(start, h), basis: h.positionBasis === 'places-latest' ? 'latest PLACES position' : h.kind === 'lander' ? 'landing site' : 'landing site; final position not mapped', sourceUrl: h.sourceUrl })).sort((a, b) => a.km - b.km).slice(0, 3),
    };
  }
}
