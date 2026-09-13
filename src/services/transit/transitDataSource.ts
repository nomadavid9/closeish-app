/**
 * The contract for transit data, independent of where it comes from.
 *
 * Two implementations exist: `transitland.ts` calls the live Transitland REST
 * API, and `mockTransitland.ts` serves hand-authored fixtures. Both satisfy
 * `TransitDataSource`, so the trip-building pipeline never knows which one it
 * is talking to and can run with no API key and no network.
 *
 * The `apiKey` parameter is part of the shared shape even though the mock
 * ignores it. Keeping the signatures identical is what makes the two
 * genuinely substitutable.
 */

import { Coordinates } from '../../types/geo';
import { Departure, DirectionId, GtfsTime, Station, TransitLineRef } from '../../types/transit';

/**
 * A stop near the origin, together with the lines that serve it.
 *
 * These arrive together because Transitland's stops endpoint embeds
 * `routes_serving_stop` in its response — fetching them separately would mean
 * an extra API call per stop for data already in hand. `Station` itself stays
 * free of line references so that it remains a plain fact about a place.
 */
export type NearbyStop = {
  station: Station;
  lines: TransitLineRef[];
};

export type FetchNearbyStopsParams = {
  origin: Coordinates;
  /** Walk budget, converted to a search radius via WALK_SPEED_M_PER_MIN. */
  walkMinutes: number;
  apiKey: string;
};

export type FetchStopSequenceParams = {
  lineId: string;
  directionId: DirectionId;
  /** Where the rider boards. Only stations beyond this one are returned. */
  fromStationId: string;
  apiKey: string;
};

export type FetchDeparturesParams = {
  stationId: string;
  /** Inclusive window start, local wall-clock. */
  startTime: GtfsTime;
  /** Inclusive window end. May exceed 24:00:00 to reach past midnight. */
  endTime: GtfsTime;
  /** Narrow to a single line; omit for every departure at the station. */
  lineId?: string;
  apiKey: string;
};

export type TransitDataSource = {
  /** Stops within walking distance of the origin, with their serving lines. */
  fetchNearbyStops(params: FetchNearbyStopsParams): Promise<NearbyStop[]>;

  /**
   * The ordered stations a line reaches *after* the boarding station, in the
   * given direction. Stations behind the rider are omitted deliberately:
   * places near where you got on are already covered by ordinary walking
   * search, so searching them again would spend Places calls for nothing.
   */
  fetchStopSequence(params: FetchStopSequenceParams): Promise<Station[]>;

  /** Scheduled departures from a station inside a time window. */
  fetchDepartures(params: FetchDeparturesParams): Promise<Departure[]>;
};
