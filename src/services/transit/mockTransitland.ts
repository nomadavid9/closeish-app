/**
 * Offline implementation of `TransitDataSource`.
 *
 * Serves the Carlsbad fixtures so the whole trip-building pipeline —
 * traversal, feasibility, scoring, cards, map — runs with no API key and no
 * network. It satisfies the same contract as the live Transitland service, so
 * callers are unaware of which one they have.
 *
 * ── What this does and does not prove ─────────────────────────────────────
 * The seam sits *beside* the real service, not underneath it: this module
 * returns already-mapped domain types rather than raw Transitland JSON. That
 * is deliberate. Fixtures of raw API responses would have to be authored from
 * documentation rather than captured from the live API, so the response
 * mapping would only ever be checked against a guess about the wire format —
 * and if the guess were wrong, fixture and mapper would be wrong together and
 * silent about it.
 *
 * So this verifies the pipeline. It makes no claim about response mapping,
 * which needs real captured responses once an API key exists (see #51).
 */

import { Coordinates } from '../../types/geo';
import { Departure, Station, TransitLineRef } from '../../types/transit';
import { WALK_SPEED_M_PER_MIN } from '../../config/dataSources';
import {
  FetchDeparturesParams,
  FetchNearbyStopsParams,
  FetchStopSequenceParams,
  NearbyStop,
  TransitDataSource,
} from './transitDataSource';
import { MOCK_DEPARTURES, MOCK_LINES, MOCK_STATIONS } from './fixtures/carlsbad';

/**
 * Simulated network latency, in milliseconds.
 *
 * Not padding for realism's sake: without it every fetch resolves in the same
 * tick, loading states never render, and the `loadingPhase` stages added in
 * app wiring would be untestable by eye.
 */
const MOCK_LATENCY_MS = 180;

const delay = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
const haversineMeters = (a: Coordinates, b: Coordinates): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

const toMinutes = (time: string): number => {
  const [hh, mm, ss] = time.split(':').map(Number);
  return hh * 60 + mm + Math.floor((ss ?? 0) / 60);
};

const toLineRef = (lineId: string): TransitLineRef | undefined => {
  const line = MOCK_LINES.find((candidate) => candidate.id === lineId);
  if (!line) return undefined;
  return { id: line.id, name: line.name, mode: line.mode, color: line.color };
};

/** Which fixture lines call at a given station. */
const linesServingStation = (stationId: string): TransitLineRef[] =>
  MOCK_LINES.filter((line) =>
    [...line.stationsDirection0, ...line.stationsDirection1].some((s) => s.id === stationId),
  ).map((line) => ({ id: line.id, name: line.name, mode: line.mode, color: line.color }));

export const fetchNearbyStops = ({
  origin,
  walkMinutes,
}: FetchNearbyStopsParams): Promise<NearbyStop[]> => {
  const radiusMeters = walkMinutes * WALK_SPEED_M_PER_MIN;

  const nearby = MOCK_STATIONS.filter(
    (station) => haversineMeters(origin, station.location) <= radiusMeters,
  )
    .sort(
      (a, b) =>
        haversineMeters(origin, a.location) - haversineMeters(origin, b.location),
    )
    .map((station) => ({ station, lines: linesServingStation(station.id) }));

  return delay(nearby);
};

export const fetchStopSequence = ({
  lineId,
  directionId,
  fromStationId,
}: FetchStopSequenceParams): Promise<Station[]> => {
  const line = MOCK_LINES.find((candidate) => candidate.id === lineId);
  if (!line) return delay([]);

  const stations = directionId === 0 ? line.stationsDirection0 : line.stationsDirection1;
  const boardingIndex = stations.findIndex((station) => station.id === fromStationId);

  // Not on this line in this direction — no onward journey from here.
  if (boardingIndex === -1) return delay([]);

  // Only what lies ahead: places behind the rider are already covered by
  // ordinary walking search.
  return delay(stations.slice(boardingIndex + 1));
};

export const fetchDepartures = ({
  stationId,
  startTime,
  endTime,
  lineId,
}: FetchDeparturesParams): Promise<Departure[]> => {
  const windowStart = toMinutes(startTime);
  const windowEnd = toMinutes(endTime);

  const matches = MOCK_DEPARTURES.filter((departure) => {
    if (departure.stationId !== stationId) return false;
    if (lineId && departure.lineId !== lineId) return false;

    const at = toMinutes(departure.scheduledTime);
    return at >= windowStart && at <= windowEnd;
  })
    .sort((a, b) => toMinutes(a.scheduledTime) - toMinutes(b.scheduledTime))
    .map(({ scheduledTime, tripId, headsign, stopSequence }) => ({
      scheduledTime,
      tripId,
      headsign,
      stopSequence,
    }));

  return delay(matches);
};

/** Convenience for callers that want to pass the whole source around. */
export const mockTransitDataSource: TransitDataSource = {
  fetchNearbyStops,
  fetchStopSequence,
  fetchDepartures,
};

export { toLineRef };
