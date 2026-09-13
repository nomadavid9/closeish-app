import { Coordinates } from './geo';

/**
 * The GTFS route_type values this app models.
 *
 * GTFS defines many more (including the extended 100-1700 ranges); the
 * Transitland service maps everything else onto the closest match here.
 * These names are load-bearing: the per-mode ride caps in
 * `config/dataSources.ts` are keyed by them.
 */
export type TransitMode =
  | 'commuter_rail' // GTFS route_type 2
  | 'subway' //        GTFS route_type 1
  | 'light_rail' //    GTFS route_type 0
  | 'bus' //           GTFS route_type 3
  | 'ferry' //         GTFS route_type 4
  | 'cable_car'; //    GTFS route_type 5

/** GTFS convention: every line runs in two directions, 0 and 1. */
export type DirectionId = 0 | 1;

/**
 * A local wall-clock time, formatted "HH:MM:SS".
 *
 * Deliberately a string rather than a Date. GTFS times are local to the
 * agency and are allowed to exceed 24 hours — "25:30:00" means 1:30am on
 * the next service day, which is how agencies express a last train. A Date
 * cannot represent that. Zero-padding also means plain string comparison
 * gives correct chronological ordering within a service day.
 *
 * The trade-off is that no timezone travels with the value, so pair it with
 * the relevant `Station.timezone` whenever converting to an absolute instant.
 * All arithmetic on these belongs in a single time helper — never parse them
 * inline.
 */
export type GtfsTime = string;

export type Station = {
  id: string; // Transitland onestop_id — stable across feed updates
  name: string;
  location: Coordinates;
  /**
   * IANA zone, e.g. "America/New_York". Required, not cosmetic: feasibility
   * depends on sunset, and sunset has to be computed in the rider's own
   * timezone for the app to work outside a single metro.
   */
  timezone: string;
  wheelchairAccessible: boolean;
};

export type TransitLine = {
  id: string; // Transitland route onestop_id
  name: string;
  mode: TransitMode;
  agencyName: string;
  color?: string; // hex, from GTFS route_color
  /** Stations in order, direction 0 (typically toward terminus A). */
  stationsDirection0: Station[];
  /** Stations in order, direction 1 (typically toward terminus B). */
  stationsDirection1: Station[];
};

/**
 * A line reference light enough to embed in results.
 *
 * A full `TransitLine` drags two arrays of up to ~50 stations behind it.
 * Embedding that in every leg of every trip would duplicate thousands of
 * station objects across a single result set, so results carry this instead.
 */
export type TransitLineRef = Pick<TransitLine, 'id' | 'name' | 'mode' | 'color'>;

/**
 * A station as reached by a particular search — not a station in the abstract.
 *
 * `Station` is a fact about the world; `StationVisit` is a fact about your
 * trip. The same station reached via two lines produces two visits, with
 * different hop counts and ride times, and those are genuinely different
 * travel options.
 */
export type StationVisit = {
  station: Station;
  line: TransitLineRef;
  directionId: DirectionId;
  /** Stops travelled from the origin station (1 = the very next stop). */
  hopsFromOrigin: number;
  /** Cumulative estimated ride time from the origin station, in minutes. */
  estimatedRideMinutes: number;
  /**
   * True when this station's place-search radius substantially overlaps the
   * previous station's, so searching around it would surface the same places.
   * Overlapped stations are skipped to conserve the Places call budget.
   */
  overlapped: boolean;
};

export type Departure = {
  scheduledTime: GtfsTime;
  /** Present only when the agency publishes GTFS-realtime. */
  realTime?: GtfsTime;
  tripId: string;
  headsign: string;
  stopSequence: number;
};
