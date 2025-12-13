import { PLACES_MAX_RESULTS, PLACES_RADIUS_METERS } from '../../config/dataSources';
import { Coordinates } from '../../types/geo';
import { Place, PlaceCategory } from '../../types/places';

const categoryToType: Record<PlaceCategory, google.maps.places.PlaceType> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  bar: 'bar',
  park: 'park',
};

const estimateTravel = (distanceMeters: number) => {
  const walkMinutes = Math.round(distanceMeters / 80); // ~5km/h
  const transitMinutes = Math.max(4, Math.round(walkMinutes * 0.7));
  const driveMinutes = Math.max(3, Math.round(walkMinutes * 0.4));
  return { walkMinutes, transitMinutes, driveMinutes };
};

const haversineDistance = (a: Coordinates, b: Coordinates) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const mapResultToPlace = (result: google.maps.places.PlaceResult, origin: Coordinates): Place | null => {
  const location = result.geometry?.location;
  if (!location) return null;

  const lat = location.lat();
  const lng = location.lng();
  const category = (result.types?.find((t) => t === 'restaurant' || t === 'cafe' || t === 'bar' || t === 'park') as PlaceCategory) ?? 'restaurant';

  const distanceMeters = haversineDistance(origin, { lat, lng });

  return {
    id: result.place_id ?? `${lat},${lng}`,
    name: result.name ?? 'Unknown place',
    category,
    location: { lat, lng },
    rating: result.rating,
    travel: estimateTravel(distanceMeters),
    source: 'live',
  };
};

export type NearbyParams = {
  origin: Coordinates;
  category?: PlaceCategory;
  radiusMeters?: number;
  maxResults?: number;
};

export const fetchGoogleNearby = async ({ origin, category, radiusMeters, maxResults }: NearbyParams): Promise<Place[]> => {
  await google.maps.importLibrary('places');
  if (!google.maps.places?.PlacesService) {
    throw new Error('PlacesService not available');
  }

  const service = new google.maps.places.PlacesService(document.createElement('div'));

  const request: google.maps.places.PlaceSearchRequest = {
    location: origin,
    rankBy: google.maps.places.RankBy.PROMINENCE,
    radius: radiusMeters ?? PLACES_RADIUS_METERS,
    type: category ? categoryToType[category] : undefined,
  };

  return new Promise((resolve, reject) => {
    service.nearbySearch(request, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        reject(new Error(`Places nearby search failed: ${status}`));
        return;
      }

      const capped = results.slice(0, maxResults ?? PLACES_MAX_RESULTS);
      const mapped = capped
        .map((r) => mapResultToPlace(r, origin))
        .filter((p): p is Place => Boolean(p));
      resolve(mapped);
    });
  });
};
