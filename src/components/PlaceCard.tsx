import React from 'react';
import { Place } from '../types/places';

type PlaceCardProps = {
  place: Place;
  closishScore: number;
  selected: boolean;
  onSelect: (placeId: string) => void;
};

type TripSummary = {
  totalMinutes: number;
  transitMinutes: number;
  walkMinutes: number;
  transferCount: number | null;
};

const formatCategory = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getTripSummary = (place: Place): TripSummary => {
  if (!place.transitPath) {
    return {
      totalMinutes: place.travel.transitMinutes + place.travel.walkMinutes,
      transitMinutes: place.travel.transitMinutes,
      walkMinutes: place.travel.walkMinutes,
      transferCount: null,
    };
  }

  const walkMinutes =
    (place.transitPath.accessWalkMinutes ?? 0) +
    (place.transitPath.transferWalkMinutes ?? 0) +
    (place.transitPath.egressWalkMinutes ?? 0);
  const totalMinutes = place.transitPath.totalMinutes ?? place.travel.transitMinutes;
  const waitMinutes = place.transitPath.waitMinutes ?? 0;
  const transitMinutes = place.transitPath.inVehicleMinutes ?? Math.max(0, totalMinutes - walkMinutes - waitMinutes);
  const transferCount = place.transitPath.transferCount ?? Math.max((place.transitPath.transitLegCount ?? 1) - 1, 0);

  return { totalMinutes, transitMinutes, walkMinutes, transferCount };
};

const PlaceCard: React.FC<PlaceCardProps> = ({ place, closishScore, selected, onSelect }) => {
  const trip = getTripSummary(place);

  return (
    <button
      type="button"
      className={`place-card ${selected ? 'selected' : ''}`}
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
        <span className="place-chip">walk {trip.walkMinutes}m</span>
        <span className="place-chip">transit {trip.transitMinutes}m</span>
        {trip.transferCount != null ? (
          <span className="place-chip">
            {trip.transferCount} transfer{trip.transferCount === 1 ? '' : 's'}
          </span>
        ) : null}
        <span className="place-chip">{place.source === 'live' ? 'live' : 'mock'}</span>
      </div>
    </button>
  );
};

export default PlaceCard;
