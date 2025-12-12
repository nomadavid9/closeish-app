export type PlaceType = 'restaurants' | 'cafes' | 'bars' | 'parks';
export type WhenOption = 'now' | 'later';
export type TimeWindow = 'next_30' | 'next_60' | 'next_120';
export type WalkVsTransit = 'favor_transit' | 'balanced' | 'prefer_walk';

export type FilterState = {
  liveMode: boolean;
  placeType: PlaceType;
  when: WhenOption;
  timeWindow: TimeWindow;
  walkVsTransit: WalkVsTransit;
  maxWalkMinutes: number;
};

export const filterDefaults: FilterState = {
  liveMode: true,
  placeType: 'restaurants',
  when: 'now',
  timeWindow: 'next_60',
  walkVsTransit: 'favor_transit',
  maxWalkMinutes: 10,
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
