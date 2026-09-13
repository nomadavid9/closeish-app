import { Coordinates } from './geo';
import { Place } from './places';
import { DirectionId, GtfsTime, Station, TransitLineRef } from './transit';

export type WalkLeg = {
  fromLabel: string; // e.g. "Home", "Departure station"
  toLabel: string;
  from: Coordinates;
  to: Coordinates;
  estimatedMinutes: number;
};

export type TransitLeg = {
  line: TransitLineRef;
  fromStation: Station;
  toStation: Station;
  directionId: DirectionId;
  scheduledDepartureTime: GtfsTime;
  scheduledArrivalTime: GtfsTime;
  estimatedRideMinutes: number;
};

/**
 * Proof that the return journey exists.
 *
 * Despite the name this is less about how long you stay than about what is
 * still available when you want to leave: the window bounded by your
 * requested dwell on one side and the daylight cutoff on the other, plus how
 * many departures actually fall inside it.
 */
export type DwellWindow = {
  /** What the user asked for, from filters. */
  requestedMinutes: number;
  /** Earliest return departure that satisfies the requested dwell. */
  earliestReturn: GtfsTime;
  /** Latest return departure still inside the daylight cutoff. */
  latestReturn: GtfsTime;
  /**
   * How many return departures exist in the window. Feeds the scorer:
   * six ways home is a materially better trip than one last train.
   */
  returnCount: number;
};

/**
 * Why a trip does or does not work.
 *
 * Infeasible trips are kept and shown, not filtered out — telling someone
 * "you couldn't get back before dark" is useful information, not noise.
 */
export type FeasibilityStatus =
  | 'feasible'
  | 'no_return_in_window'
  | 'after_daylight_cutoff'
  | 'ride_exceeds_mode_tolerance'
  | 'walk_too_long';

export type TripFeasibility = {
  status: FeasibilityStatus;
  /** Human-readable explanation, shown on infeasible trip cards. */
  reason?: string;
};

export type TripScore = {
  total: number; // 0-100
  components: {
    transitAdvantage: number; // transit beats driving (0-35)
    walkPenalty: number; //     long walks penalised (-20-0)
    desirability: number; //    place rating bonus (0-20)
    modePremium: number; //     rail over bus (0-10)
    returnFlexibility: number; // more ways home is better (0-15)
  };
};

/**
 * A complete round trip: walk, ride, spend time somewhere, ride back, walk home.
 *
 * This is the app's primary unit in v2, replacing the v1 `Place`. The
 * difference is that a trip has to close — a destination you cannot return
 * from is not a result, and the symmetric leg structure below is what makes
 * that checkable.
 */
export type Trip = {
  /** `${line.id}-${arrivalStation.id}-${place.id}` — the same place reached
   *  by two lines is two distinct trips, so it cannot be deduped by place. */
  id: string;
  origin: Coordinates;

  // Outbound
  walkToStation: WalkLeg;
  outboundTransit: TransitLeg;
  walkToPlace: WalkLeg;

  // Destination
  destinationPlace: Place;
  dwell: DwellWindow;

  // Return (mirrors outbound)
  walkToReturnStation: WalkLeg;
  returnTransit: TransitLeg;
  walkHome: WalkLeg;

  feasibility: TripFeasibility;
  /** Undefined until the trip has been through the scorer. */
  score?: TripScore;
  source: 'live' | 'mock';
};
