export type PlaceType = 'restaurants' | 'cafes' | 'bars' | 'parks';
export type WhenOption = 'now' | 'later';
export type TimeWindow = 'next_30' | 'next_60' | 'next_120';
export type WalkVsTransit = 'favor_transit' | 'balanced' | 'prefer_walk';

/**
 * User-facing mode vocabulary, deliberately coarser than `TransitMode`.
 * "train" fans out to commuter_rail, subway and light_rail — see
 * `modesForPreference` in `config/dataSources.ts` for the one mapping.
 */
export type ModePreference = 'all' | 'train' | 'bus';

/**
 * How close to sunset a return journey is still acceptable. Applied to the
 * origin's local sunset, so it means the same thing in every timezone.
 */
export type DaylightCutoff =
  | 'sunset_minus_60'
  | 'sunset_minus_30'
  | 'at_sunset'
  | 'sunset_plus_30'
  | 'sunset_plus_60'
  | 'none';

export type FilterState = {
  liveMode: boolean;
  placeType: PlaceType;
  when: WhenOption;
  timeWindow: TimeWindow;
  walkVsTransit: WalkVsTransit;
  /**
   * Total walking budget across all legs of a trip (to the station, from the
   * arrival station to the place, and home again). The scorer penalises trips
   * that exceed it; it is not a hard filter.
   */
  maxTotalWalkMinutes: number;
  /**
   * How far the user will walk to reach a departure station. Used as the
   * search radius when discovering origin stops — a different question from
   * the total budget above, which is why they are separate fields.
   */
  stationSearchWalkMinutes: number;
  /** How long the user wants at the destination before heading back. */
  dwellWindowMinutes: number;
  modePreference: ModePreference;
  daylightCutoff: DaylightCutoff;
};

export const filterDefaults: FilterState = {
  liveMode: true,
  placeType: 'restaurants',
  when: 'now',
  timeWindow: 'next_60',
  walkVsTransit: 'favor_transit',
  maxTotalWalkMinutes: 10,
  stationSearchWalkMinutes: 10,
  dwellWindowMinutes: 180,
  modePreference: 'all',
  daylightCutoff: 'sunset_plus_30',
};

export const placeTypeOptions: { label: string; value: PlaceType }[] = [
  { label: 'Restaurants & cafes', value: 'restaurants' },
  { label: 'Bars', value: 'bars' },
  { label: 'Parks', value: 'parks' },
  { label: 'Cafes', value: 'cafes' },
];

export const walkVsTransitOptions: { label: string; value: WalkVsTransit }[] = [
  { label: 'Favor transit', value: 'favor_transit' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Prefer walk', value: 'prefer_walk' },
];

export const timeWindowOptions: { label: string; value: TimeWindow }[] = [
  { label: 'Next 30 min', value: 'next_30' },
  { label: 'Next 60 min', value: 'next_60' },
  { label: 'Next 2 hours', value: 'next_120' },
];

export const modePreferenceOptions: { label: string; value: ModePreference }[] = [
  { label: 'Any transit', value: 'all' },
  { label: 'Train only', value: 'train' },
  { label: 'Bus only', value: 'bus' },
];

export const dwellWindowOptions: { label: string; value: number }[] = [
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: 'Half a day', value: 360 },
];

export const daylightCutoffOptions: { label: string; value: DaylightCutoff }[] = [
  { label: 'Home an hour before sunset', value: 'sunset_minus_60' },
  { label: 'Home 30 min before sunset', value: 'sunset_minus_30' },
  { label: 'Home by sunset', value: 'at_sunset' },
  { label: 'Home 30 min after sunset', value: 'sunset_plus_30' },
  { label: 'Home an hour after sunset', value: 'sunset_plus_60' },
  { label: "Don't mind the dark", value: 'none' },
];
