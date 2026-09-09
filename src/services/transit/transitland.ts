/**
 * Transitland REST API v2 service.
 *
 * Three operations needed by the v2 trip-planning algorithm:
 *   1. findStopsNear       — stops within walk radius of origin
 *   2. findRoutesAtStop    — routes serving a given stop
 *   3. getStopsAlongRoute  — ordered stop sequence per direction
 *
 * All functions accept the API key explicitly so callers control
 * where it comes from (env var, future config, etc.).
 *
 * API reference: https://www.transit.land/documentation/rest-api
 */

import { Coordinates } from '../../types/geo';
import { TransitDirection, TransitMode, TransitRoute, TransitStop, TransitRouteWithStops } from '../../types/transit';

const BASE_URL = 'https://transit.land/api/v2/rest';

// ── Transitland raw response shapes ────────────────────────────────────────

type TLStop = {
  onestop_id: string;
  stop_name: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
};

type TLStopsResponse = {
  stops: TLStop[];
  meta?: { after?: number; next?: string };
};

type TLAgency = {
  agency_name: string;
};

type TLRoute = {
  onestop_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // GTFS route_type integer
  agency: TLAgency;
};

type TLRoutesResponse = {
  routes: TLRoute[];
};

type TLRouteStopPattern = {
  direction_id: 0 | 1;
  trip_headsign: string;
  stop_distances: Array<{ stop: TLStop }>;
};

type TLRouteStopPatternsResponse = {
  route_stop_patterns: TLRouteStopPattern[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const GTFS_ROUTE_TYPE_MAP: Record<number, TransitMode> = {
  0: 'tram',
  1: 'light_rail',
  2: 'rail',
  3: 'bus',
  4: 'ferry',
  5: 'cable_car',
  7: 'other',
  11: 'bus',  // trolleybus
  12: 'rail', // monorail
  // Extended GTFS types (100-range = rail, 700-range = bus, etc.)
};

const toMode = (routeType: number): TransitMode => {
  if (GTFS_ROUTE_TYPE_MAP[routeType]) return GTFS_ROUTE_TYPE_MAP[routeType];
  if (routeType >= 100 && routeType < 200) return 'rail';
  if (routeType >= 200 && routeType < 300) return 'rail';
  if (routeType >= 700 && routeType < 800) return 'bus';
  if (routeType >= 900 && routeType < 1000) return 'tram';
  return 'other';
};

const tlStopToTransitStop = (raw: TLStop): TransitStop => ({
  id: raw.onestop_id,
  name: raw.stop_name,
  location: {
    lat: raw.geometry.coordinates[1],
    lng: raw.geometry.coordinates[0],
  },
});

const tlRouteToTransitRoute = (raw: TLRoute): TransitRoute => ({
  id: raw.onestop_id,
  name: raw.route_short_name || raw.route_long_name,
  mode: toMode(raw.route_type),
  agencyName: raw.agency.agency_name,
});

const buildHeaders = (apiKey: string): HeadersInit => ({
  apikey: apiKey,
});

const checkResponse = async (response: Response, context: string): Promise<void> => {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const text = await response.text();
      if (text) detail = text;
    } catch { /* swallow */ }
    throw new Error(`Transitland ${context} error ${response.status}: ${detail}`);
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Find transit stops within `radiusMeters` of `origin`.
 * Transitland's radius parameter is in meters.
 */
export const findStopsNear = async ({
  origin,
  radiusMeters,
  apiKey,
}: {
  origin: Coordinates;
  radiusMeters: number;
  apiKey: string;
}): Promise<TransitStop[]> => {
  const params = new URLSearchParams({
    lat: String(origin.lat),
    lon: String(origin.lng),
    radius: String(radiusMeters),
    per_page: '50',
  });

  const response = await fetch(`${BASE_URL}/stops?${params}`, {
    headers: buildHeaders(apiKey),
  });

  await checkResponse(response, 'findStopsNear');

  const data: TLStopsResponse = await response.json();
  return (data.stops ?? []).map(tlStopToTransitStop);
};

/**
 * Find all routes serving a given stop (by its Transitland onestop_id).
 */
export const findRoutesAtStop = async ({
  stopId,
  apiKey,
}: {
  stopId: string;
  apiKey: string;
}): Promise<TransitRoute[]> => {
  const params = new URLSearchParams({
    stop_id: stopId,
    per_page: '50',
  });

  const response = await fetch(`${BASE_URL}/routes?${params}`, {
    headers: buildHeaders(apiKey),
  });

  await checkResponse(response, 'findRoutesAtStop');

  const data: TLRoutesResponse = await response.json();
  return (data.routes ?? []).map(tlRouteToTransitRoute);
};

/**
 * Get the ordered stop sequences for a route, grouped by direction.
 * Returns at most two directions (outbound=0, inbound=1).
 *
 * Transitland's route_stop_patterns endpoint returns one pattern per
 * direction+headsign combination. We pick the longest pattern per
 * direction so we see every possible stop along that branch.
 */
export const getStopsAlongRoute = async ({
  routeId,
  apiKey,
}: {
  routeId: string;
  apiKey: string;
}): Promise<TransitRouteWithStops['directions']> => {
  const params = new URLSearchParams({
    route_id: routeId,
    per_page: '100',
  });

  const response = await fetch(`${BASE_URL}/route_stop_patterns?${params}`, {
    headers: buildHeaders(apiKey),
  });

  await checkResponse(response, 'getStopsAlongRoute');

  const data: TLRouteStopPatternsResponse = await response.json();
  const patterns = data.route_stop_patterns ?? [];

  // Group patterns by direction_id, keep longest stop list per direction.
  const byDirection = new Map<0 | 1, TLRouteStopPattern>();

  for (const pattern of patterns) {
    const existing = byDirection.get(pattern.direction_id);
    if (!existing || pattern.stop_distances.length > existing.stop_distances.length) {
      byDirection.set(pattern.direction_id, pattern);
    }
  }

  const directions: TransitDirection[] = [];

  for (const [directionId, pattern] of byDirection) {
    directions.push({
      directionId,
      headsign: pattern.trip_headsign,
      stops: pattern.stop_distances.map((sd) => tlStopToTransitStop(sd.stop)),
    });
  }

  return directions;
};

/**
 * Convenience: given a stop, return all routes with their full stop sequences.
 * This is the single call the traversal algorithm needs per origin stop.
 */
export const getRoutesWithStopsAtStop = async ({
  stopId,
  apiKey,
}: {
  stopId: string;
  apiKey: string;
}): Promise<TransitRouteWithStops[]> => {
  const routes = await findRoutesAtStop({ stopId, apiKey });

  const results = await Promise.all(
    routes.map(async (route) => {
      const directions = await getStopsAlongRoute({ routeId: route.id, apiKey });
      return { ...route, directions };
    })
  );

  return results;
};
