/**
 * Offline transit fixtures: North County San Diego.
 *
 * Modelled on NCTD's real network around Carlsbad — the COASTER commuter rail
 * line up the coast, and a BREEZE bus route paralleling it. Chosen because it
 * is the app's thesis in miniature: a car-dependent metro with one rail line,
 * sparse service, and a genuine "can I still get home?" problem. Boston would
 * make every trip feasible and prove nothing.
 *
 * ── Accuracy ───────────────────────────────────────────────────────────────
 * Coordinates and timetables are plausible, not authoritative. They were hand
 * authored from general knowledge of the corridor, NOT scraped from GTFS. They
 * are internally consistent — every station's departure times derive from one
 * timetable plus that station's ride offset, so arrivals and returns line up —
 * but do not treat them as ground truth for real trip planning. Replace with
 * captured live responses once an API key is available.
 *
 * ── What this fixture is built to exercise ────────────────────────────────
 * 1. A feasible rail trip with several ways home        (COASTER southbound)
 * 2. `no_return_in_window` — service ends too early     (late COASTER arrivals)
 * 3. `after_daylight_cutoff` — return exists, but dark  (evening returns)
 * 4. `ride_exceeds_mode_tolerance` — 25-minute bus cap  (BREEZE past Poinsettia)
 * 5. `overlapped` stations closer than 320m apart       (first two bus stops)
 * 6. A past-midnight "24:15:00" departure                (Friday late train)
 *
 * Scenario 6 is the one that would silently break a Date-based time
 * implementation: GTFS expresses 12:15am on the next service day as 24:15:00,
 * and dropping it means losing exactly the departure a feasibility check cares
 * most about.
 */

import { Departure, GtfsTime, Station, TransitLine } from '../../../types/transit';

const TZ = 'America/Los_Angeles';

const station = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  wheelchairAccessible = true,
): Station => ({
  id: `mock-stop-${id}`,
  name,
  location: { lat, lng },
  timezone: TZ,
  wheelchairAccessible,
});

// ── COASTER — commuter rail, Oceanside to San Diego ─────────────────────────

export const OCEANSIDE = station('oceanside', 'Oceanside Transit Center', 33.1957, -117.3795);
export const CARLSBAD_VILLAGE = station('carlsbad-village', 'Carlsbad Village Station', 33.1608, -117.3535);
export const CARLSBAD_POINSETTIA = station('carlsbad-poinsettia', 'Carlsbad Poinsettia Station', 33.1073, -117.3122);
export const ENCINITAS = station('encinitas', 'Encinitas Station', 33.047, -117.293);
export const SOLANA_BEACH = station('solana-beach', 'Solana Beach Station', 32.991, -117.271);
export const SORRENTO_VALLEY = station('sorrento-valley', 'Sorrento Valley Station', 32.8985, -117.2035);
export const OLD_TOWN = station('old-town', 'Old Town Transit Center', 32.7553, -117.1975);
export const SANTA_FE_DEPOT = station('santa-fe-depot', 'San Diego Santa Fe Depot', 32.7157, -117.17);

/** Southbound order. Direction 0 runs toward San Diego. */
const COASTER_SOUTHBOUND = [
  OCEANSIDE,
  CARLSBAD_VILLAGE,
  CARLSBAD_POINSETTIA,
  ENCINITAS,
  SOLANA_BEACH,
  SORRENTO_VALLEY,
  OLD_TOWN,
  SANTA_FE_DEPOT,
];

/**
 * Minutes from the line's first station, per direction. Every departure time
 * in this fixture is derived from these offsets, which is what keeps outbound
 * arrivals and return departures consistent with each other.
 */
const COASTER_OFFSETS_SOUTHBOUND = [0, 7, 13, 20, 26, 36, 50, 58];
const COASTER_OFFSETS_NORTHBOUND = [0, 8, 22, 32, 38, 45, 51, 58];

/** Weekday southbound trains, departing Oceanside. Commute-peaked, sparse midday. */
const COASTER_SOUTHBOUND_TIMETABLE: GtfsTime[] = [
  '05:22:00',
  '06:07:00',
  '06:47:00',
  '07:22:00',
  '08:12:00',
  '09:47:00',
  '12:47:00',
  '14:47:00',
  '15:47:00',
  '16:47:00',
  '17:47:00',
  '18:47:00',
  '20:02:00',
];

/**
 * Weekday northbound trains, departing San Diego. These are the trips home.
 * Note the last two: 21:35 is the ordinary last train, and 24:15 is the
 * Friday late service — expressed past midnight, per GTFS convention.
 */
const COASTER_NORTHBOUND_TIMETABLE: GtfsTime[] = [
  '05:50:00',
  '06:50:00',
  '07:50:00',
  '09:20:00',
  '11:20:00',
  '13:20:00',
  '15:05:00',
  '16:05:00',
  '17:05:00',
  '17:50:00',
  '18:35:00',
  '19:20:00',
  '21:35:00',
  '24:15:00',
];

// ── BREEZE 101 — bus, coastal, paralleling the rail line ────────────────────
//
// The first two stops sit ~275m apart, inside the 320m overlap threshold, so
// this route is what exercises overlap detection. Closely spaced stops are a
// real property of bus routes, not a contrivance for the fixture.

/**
 * The bus route starts at the same transit center the COASTER calls at — one
 * physical place, one station id, two lines serving it. Modelling it as two
 * separate stops would be wrong twice over: it would duplicate the origin
 * during traversal, and it would mean no stop in the fixture ever serves more
 * than one line, which is the case `NearbyStop.lines` exists to handle.
 */
export const BUS_CARLSBAD_VILLAGE = CARLSBAD_VILLAGE;
export const BUS_STATE_ST = station('bus-state-st', 'Carlsbad Village Dr & State St', 33.1595, -117.351);
export const BUS_TAMARACK = station('bus-tamarack', 'Carlsbad Blvd & Tamarack Ave', 33.147, -117.3455, false);
export const BUS_POINSETTIA = station('bus-poinsettia', 'Carlsbad Blvd & Poinsettia Ln', 33.121, -117.323);
export const BUS_LEUCADIA = station('bus-leucadia', 'Coast Hwy 101 & Leucadia Blvd', 33.068, -117.301, false);
export const BUS_ENCINITAS = station('bus-encinitas', 'Coast Hwy 101 & Encinitas Blvd', 33.048, -117.2925);
export const BUS_LOMAS_SANTA_FE = station('bus-lomas-santa-fe', 'Hwy 101 & Lomas Santa Fe Dr', 32.999, -117.268);
export const BUS_DEL_MAR = station('bus-del-mar', 'Camino Del Mar & Del Mar Heights Rd', 32.945, -117.253);

const BREEZE_SOUTHBOUND = [
  BUS_CARLSBAD_VILLAGE,
  BUS_STATE_ST,
  BUS_TAMARACK,
  BUS_POINSETTIA,
  BUS_LEUCADIA,
  BUS_ENCINITAS,
  BUS_LOMAS_SANTA_FE,
  BUS_DEL_MAR,
];

/**
 * Cumulative bus minutes. The 25-minute bus ride cap bites between Poinsettia
 * (16 min, reachable) and Leucadia (27 min, past the cap) — so traversal
 * should stop there, and a fixture that never crossed a cap would not prove
 * the cap works.
 */
const BREEZE_OFFSETS_SOUTHBOUND = [0, 2, 8, 16, 27, 33, 45, 58];
const BREEZE_OFFSETS_NORTHBOUND = [0, 13, 25, 31, 42, 50, 56, 58];

/** Every 30 minutes, roughly 06:00 to 21:00. */
const BREEZE_TIMETABLE: GtfsTime[] = Array.from({ length: 31 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
});

// ── Lines ───────────────────────────────────────────────────────────────────

export const COASTER: TransitLine = {
  id: 'mock-line-coaster',
  name: 'COASTER',
  mode: 'commuter_rail',
  agencyName: 'North County Transit District',
  color: '#0B5FA5',
  stationsDirection0: COASTER_SOUTHBOUND,
  stationsDirection1: [...COASTER_SOUTHBOUND].reverse(),
};

export const BREEZE_101: TransitLine = {
  id: 'mock-line-breeze-101',
  name: '101',
  mode: 'bus',
  agencyName: 'North County Transit District',
  color: '#00833E',
  stationsDirection0: BREEZE_SOUTHBOUND,
  stationsDirection1: [...BREEZE_SOUTHBOUND].reverse(),
};

export const MOCK_LINES: TransitLine[] = [COASTER, BREEZE_101];

// ── Derived timetable ───────────────────────────────────────────────────────

const toMinutes = (time: GtfsTime): number => {
  const [hh, mm, ss] = time.split(':').map(Number);
  return hh * 60 + mm + Math.floor((ss ?? 0) / 60);
};

const toGtfsTime = (minutes: number): GtfsTime => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

type LineSchedule = {
  line: TransitLine;
  directionId: 0 | 1;
  stations: Station[];
  offsets: number[];
  timetable: GtfsTime[];
  headsign: string;
};

const SCHEDULES: LineSchedule[] = [
  {
    line: COASTER,
    directionId: 0,
    stations: COASTER_SOUTHBOUND,
    offsets: COASTER_OFFSETS_SOUTHBOUND,
    timetable: COASTER_SOUTHBOUND_TIMETABLE,
    headsign: 'San Diego',
  },
  {
    line: COASTER,
    directionId: 1,
    stations: [...COASTER_SOUTHBOUND].reverse(),
    offsets: COASTER_OFFSETS_NORTHBOUND,
    timetable: COASTER_NORTHBOUND_TIMETABLE,
    headsign: 'Oceanside',
  },
  {
    line: BREEZE_101,
    directionId: 0,
    stations: BREEZE_SOUTHBOUND,
    offsets: BREEZE_OFFSETS_SOUTHBOUND,
    timetable: BREEZE_TIMETABLE,
    headsign: 'Del Mar',
  },
  {
    line: BREEZE_101,
    directionId: 1,
    stations: [...BREEZE_SOUTHBOUND].reverse(),
    offsets: BREEZE_OFFSETS_NORTHBOUND,
    timetable: BREEZE_TIMETABLE,
    headsign: 'Carlsbad Village',
  },
];

export type FixtureDeparture = Departure & { stationId: string; lineId: string };

/**
 * Expand the schedules into one departure per train per station.
 *
 * Times are derived rather than typed out so that the whole fixture stays
 * consistent: if a ride offset changes, every dependent arrival and return
 * moves with it. Hand-maintained timetables drift apart, and a feasibility
 * gate tested against inconsistent data proves nothing.
 */
const buildDepartures = (): FixtureDeparture[] => {
  const departures: FixtureDeparture[] = [];

  for (const schedule of SCHEDULES) {
    schedule.timetable.forEach((baseTime, tripIndex) => {
      const baseMinutes = toMinutes(baseTime);

      schedule.stations.forEach((stop, stopIndex) => {
        // The final stop of a trip is an arrival, not a departure.
        if (stopIndex === schedule.stations.length - 1) return;

        departures.push({
          stationId: stop.id,
          lineId: schedule.line.id,
          scheduledTime: toGtfsTime(baseMinutes + schedule.offsets[stopIndex]),
          tripId: `${schedule.line.id}-d${schedule.directionId}-t${tripIndex}`,
          headsign: schedule.headsign,
          stopSequence: stopIndex + 1,
        });
      });
    });
  }

  return departures;
};

export const MOCK_DEPARTURES: FixtureDeparture[] = buildDepartures();

/** Every station in the fixture, deduplicated by id. */
export const MOCK_STATIONS: Station[] = Array.from(
  new Map([...COASTER_SOUTHBOUND, ...BREEZE_SOUTHBOUND].map((s) => [s.id, s])).values(),
);
