import { ModePreference } from '../types/filters';
import { TransitMode } from '../types/transit';

export const PLACES_RADIUS_METERS = 1500; // default search radius; can tune per filters
export const PLACES_MAX_RESULTS = 20; // cap for initial nearby search
export const PLACES_TOP_K = 8; // final ranked list size shown in UI
export const TRANSIT_ENRICH_TOP_N = 6; // live candidates enriched with Routes transit details

// ── v2 trip planning ────────────────────────────────────────────────────────

/** Average walking pace, used to turn a walk-time budget into a radius. */
export const WALK_SPEED_M_PER_MIN = 80;

/** Radius searched for places around each reachable station. */
export const PLACE_HALO_RADIUS_M = 800;

/**
 * How much two adjacent stations' halos may overlap before the second is
 * skipped. At 0.6, stations closer than 40% of the halo radius are treated
 * as covering the same ground — searching both would burn a Places call to
 * return the same restaurants.
 */
export const OVERLAP_SKIP_THRESHOLD = 0.6;

/**
 * How long people will plausibly ride each mode before the trip stops feeling
 * "closeish". These bound the traversal: it walks outward from the origin
 * until cumulative ride time exceeds the cap for that line's mode.
 *
 * Forty minutes on a subway is routine; forty minutes on a bus is a slog.
 * That asymmetry is the whole reason the caps are per-mode.
 */
export const RIDE_CAP_COMMUTER_RAIL = 60;
export const RIDE_CAP_SUBWAY = 40;
export const RIDE_CAP_LIGHT_RAIL = 35;
export const RIDE_CAP_BUS = 25;
export const RIDE_CAP_FERRY = 45;
export const RIDE_CAP_CABLE_CAR = 20;

/** Lookup form of the caps above — what the traversal actually indexes into. */
export const RIDE_CAP_BY_MODE: Record<TransitMode, number> = {
  commuter_rail: RIDE_CAP_COMMUTER_RAIL,
  subway: RIDE_CAP_SUBWAY,
  light_rail: RIDE_CAP_LIGHT_RAIL,
  bus: RIDE_CAP_BUS,
  ferry: RIDE_CAP_FERRY,
  cable_car: RIDE_CAP_CABLE_CAR,
};

/** The single place the coarse UI vocabulary maps onto real GTFS modes. */
export const modesForPreference = (preference: ModePreference): TransitMode[] => {
  switch (preference) {
    case 'train':
      return ['commuter_rail', 'subway', 'light_rail'];
    case 'bus':
      return ['bus'];
    case 'all':
      return ['commuter_rail', 'subway', 'light_rail', 'bus', 'ferry', 'cable_car'];
  }
};

/** Minutes to add to local sunset for each daylight cutoff setting. */
export const DAYLIGHT_CUTOFF_OFFSET_MINUTES = {
  sunset_minus_60: -60,
  sunset_minus_30: -30,
  at_sunset: 0,
  sunset_plus_30: 30,
  sunset_plus_60: 60,
} as const;

/** Final ranked list size shown in the UI. */
export const TRIPS_TOP_K = 10;

export const DEFAULT_DWELL_MINUTES = 180;
