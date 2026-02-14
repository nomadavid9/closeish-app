import React from 'react';
import InlineTripMap from './InlineTripMap';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

type PlaceCardProps = {
  place: Place;
  closishScore: number;
  selected: boolean;
  expanded: boolean;
  onToggleExpand: (placeId: string) => void;
  showInlineMap: boolean;
  origin: Coordinates | null;
  mapId?: string;
  mapReady: boolean;
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
  expanded,
  onToggleExpand,
  showInlineMap,
  origin,
  mapId,
  mapReady,
}) => {
  const trip = getTripDetails(place);
  const detailRegionId = `place-card-details-${place.id}`;

  return (
    <article className={`place-card ${selected ? 'selected' : ''}`}>
      <button
        type="button"
        className="place-card-trigger"
        onClick={() => onToggleExpand(place.id)}
        aria-expanded={expanded}
        aria-controls={detailRegionId}
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
      </button>

      {expanded ? (
        <div id={detailRegionId} className="place-card-details" role="region" aria-label={`${place.name} trip details`}>
          {trip.hasDetailedPath ? (
            <p className="trip-sequence">
              {`${trip.accessWalkMinutes}m walk -> ${trip.transitMinutes}m transit -> ${trip.egressWalkMinutes}m walk`}
            </p>
          ) : (
            <p className="trip-sequence">Estimated {trip.totalMinutes}m total</p>
          )}

          {trip.fallbackMessage ? <p className="trip-fallback">{trip.fallbackMessage}</p> : null}

          {showInlineMap && origin && mapId && mapReady ? (
            <div className="place-card-map-shell">
              <InlineTripMap
                origin={origin}
                destination={place.location}
                mapId={mapId}
                isLoaded={mapReady}
              />
            </div>
          ) : null}

          {showInlineMap && (!mapReady || !mapId || !origin) ? (
            <p className="trip-fallback">Map preview unavailable for this place right now.</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export default PlaceCard;
