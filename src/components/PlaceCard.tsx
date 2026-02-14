import React from 'react';
import { Place } from '../types/places';

type PlaceCardProps = {
  place: Place;
  closishScore: number;
  selected: boolean;
  onSelect: (placeId: string) => void;
};

type TripDetails = {
  totalMinutes: number;
  transitMinutes: number;
  walkMinutesTotal: number;
  accessWalkMinutes: number;
  egressWalkMinutes: number;
  transferCount: number | null;
  hasDetailedPath: boolean;
  fallbackMessage?: string;
};

const formatCategory = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getTripDetails = (place: Place): TripDetails => {
  if (!place.transitPath) {
    return {
      totalMinutes: place.travel.transitMinutes + place.travel.walkMinutes,
      transitMinutes: place.travel.transitMinutes,
      walkMinutesTotal: place.travel.walkMinutes,
      accessWalkMinutes: 0,
      egressWalkMinutes: 0,
      transferCount: null,
      hasDetailedPath: false,
      fallbackMessage: 'Detailed transit path is unavailable for this place. Showing estimated totals.',
    };
  }

  const accessWalkMinutes = place.transitPath.accessWalkMinutes ?? 0;
  const egressWalkMinutes = place.transitPath.egressWalkMinutes ?? 0;
  const transferWalkMinutes = place.transitPath.transferWalkMinutes ?? 0;
  const waitMinutes = place.transitPath.waitMinutes ?? 0;
  const walkMinutesTotal =
    (place.transitPath.accessWalkMinutes ?? 0) +
    (place.transitPath.transferWalkMinutes ?? 0) +
    (place.transitPath.egressWalkMinutes ?? 0);
  const totalMinutes = place.transitPath.totalMinutes ?? place.travel.transitMinutes;
  const transitMinutes =
    place.transitPath.inVehicleMinutes ??
    Math.max(0, totalMinutes - walkMinutesTotal - waitMinutes);
  const transferCount = place.transitPath.transferCount ?? Math.max((place.transitPath.transitLegCount ?? 1) - 1, 0);

  const fallbackMessage =
    transferWalkMinutes > 0
      ? `Includes about ${transferWalkMinutes}m transfer walking between transit legs.`
      : undefined;

  return {
    totalMinutes,
    transitMinutes,
    walkMinutesTotal,
    accessWalkMinutes,
    egressWalkMinutes,
    transferCount,
    hasDetailedPath: true,
    fallbackMessage,
  };
};

const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  closishScore,
  selected,
  onSelect,
}) => {
  const trip = getTripDetails(place);
  const tripSequence = trip.hasDetailedPath
    ? `${trip.accessWalkMinutes}m walk -> ${trip.transitMinutes}m transit -> ${trip.egressWalkMinutes}m walk`
    : `Estimated ${trip.totalMinutes}m total`;

  return (
    <article className={`place-card ${selected ? 'selected' : ''}`}>
      <button
        type="button"
        className="place-card-trigger"
        onClick={() => onSelect(place.id)}
        aria-pressed={selected}
      >
        <div className="place-card-head">
          <p className="place-total">{trip.totalMinutes}m total</p>
          <p className="place-rating">{place.rating != null ? `${place.rating.toFixed(1)}★` : 'No rating'}</p>
        </div>

        <p className="place-name">{place.name}</p>
        <p className="place-note">{formatCategory(place.category)} · score {closishScore.toFixed(0)}</p>

        <div className="place-chip-row">
          <span className="place-chip">walk {trip.walkMinutesTotal}m</span>
          <span className="place-chip">transit {trip.transitMinutes}m</span>
          {trip.transferCount != null ? (
            <span className="place-chip">
              {trip.transferCount} transfer{trip.transferCount === 1 ? '' : 's'}
            </span>
          ) : null}
          <span className="place-chip">{place.source === 'live' ? 'live' : 'mock'}</span>
        </div>

        <p className="trip-sequence">{tripSequence}</p>
        {trip.fallbackMessage ? <p className="trip-fallback">{trip.fallbackMessage}</p> : null}
      </button>
    </article>
  );
};

export default PlaceCard;
