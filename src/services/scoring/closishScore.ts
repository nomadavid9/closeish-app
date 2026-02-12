import { FilterState } from '../../types/filters';
import { Place, PlaceScore } from '../../types/places';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computePreferenceTilt = (filters: FilterState) =>
  filters.walkVsTransit === 'favor_transit' ? 1.0 : filters.walkVsTransit === 'balanced' ? 0.8 : 0.6;

const computeWhenTilt = (filters: FilterState) =>
  filters.when === 'now' ? 1 : filters.timeWindow === 'next_30' ? 0.98 : filters.timeWindow === 'next_60' ? 0.96 : 0.94;

// Lightweight scoring stub: reward transit advantage, penalize long walks, and add desirability.
export const scorePlace = (place: Place, filters: FilterState): PlaceScore => {
  const desirability = clamp(((place.rating ?? 4) - 3.5) * 10, 0, 20);

  // Live/when modifiers (light touch for mocks)
  const preferenceTilt = computePreferenceTilt(filters);
  const modeTilt = filters.liveMode ? 1 : 0.95;
  const whenTilt = computeWhenTilt(filters);

  if (!place.transitPath) {
    const transitBias = clamp((place.travel.driveMinutes - place.travel.transitMinutes) * 4, 0, 40);
    const walkPenalty = clamp((place.travel.walkMinutes - filters.maxWalkMinutes) * 2, -20, 0);
    const closishScore = clamp((transitBias * preferenceTilt * modeTilt * whenTilt) + walkPenalty + desirability, 0, 100);

    return {
      closishScore,
      components: { transitBias, walkPenalty, desirability },
    };
  }

  const totalTransitMinutes = place.transitPath.totalMinutes ?? place.travel.transitMinutes;
  const accessWalkMinutes = place.transitPath.accessWalkMinutes ?? 0;
  const transferWalkMinutes = place.transitPath.transferWalkMinutes ?? 0;
  const egressWalkMinutes = place.transitPath.egressWalkMinutes ?? 0;
  const transferCount = place.transitPath.transferCount ?? Math.max((place.transitPath.transitLegCount ?? 1) - 1, 0);
  const waitMinutes = place.transitPath.waitMinutes ?? 0;

  // Option A bridge: favor simple transit paths (low transfer and low walk friction).
  const totalWalkMinutes = accessWalkMinutes + transferWalkMinutes + egressWalkMinutes;
  const walkPenalty = clamp((totalWalkMinutes - filters.maxWalkMinutes) * 2.2, -20, 0);
  const transferPenalty = clamp(transferCount * 8, 0, 30);
  const waitPenalty = clamp(waitMinutes * 0.7, 0, 20);
  const transitTimePenalty = clamp((totalTransitMinutes - 40) * 0.25, 0, 10);
  const oneSeatBonus = transferCount === 0 ? 8 : transferCount === 1 ? 2 : 0;
  const transitBias = clamp((place.travel.driveMinutes - totalTransitMinutes) * 2.5, -10, 25);

  const transitEase =
    (transitBias + oneSeatBonus - transferPenalty - waitPenalty - transitTimePenalty) * preferenceTilt * modeTilt * whenTilt;
  const closishScore = clamp(35 + transitEase + walkPenalty + desirability, 0, 100);

  return {
    closishScore,
    components: {
      transitBias,
      walkPenalty,
      desirability,
      transferPenalty,
      waitPenalty,
      oneSeatBonus,
    },
  };
};
