import { FilterState } from '../../types/filters';
import { Place, PlaceScore } from '../../types/places';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Lightweight scoring stub: reward transit advantage, penalize long walks, and add desirability.
export const scorePlace = (place: Place, filters: FilterState): PlaceScore => {
  const transitBias = clamp((place.travel.driveMinutes - place.travel.transitMinutes) * 4, 0, 40);

  const walkPenalty = clamp((place.travel.walkMinutes - filters.maxWalkMinutes) * 2, -20, 0);

  const desirability = clamp(((place.rating ?? 4) - 3.5) * 10, 0, 20);

  // Adjust for walk vs transit preference
  const preferenceTilt =
    filters.walkVsTransit === 'favor_transit' ? 1.0 : filters.walkVsTransit === 'balanced' ? 0.8 : 0.6;

   // Live/when modifiers (light touch for mocks)
  const modeTilt = filters.liveMode ? 1 : 0.95;
  const whenTilt = filters.when === 'now' ? 1 : filters.timeWindow === 'next_30' ? 0.98 : filters.timeWindow === 'next_60' ? 0.96 : 0.94;

  const closishScore = clamp((transitBias * preferenceTilt * modeTilt * whenTilt) + walkPenalty + desirability, 0, 100);

  return {
    closishScore,
    components: { transitBias, walkPenalty, desirability },
  };
};
