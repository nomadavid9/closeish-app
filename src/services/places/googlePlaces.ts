import { PLACES_MAX_RESULTS, PLACES_RADIUS_METERS } from '../../config/dataSources';
import { Coordinates } from '../../types/geo';
import { Place, PlaceCategory } from '../../types/places';

const categoryToIncludedType: Record<PlaceCategory, string> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  bar: 'bar',
  park: 'park',
};

type PlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    rating?: number;
  }>;
};

const mapTypesToCategory = (types?: string[]): PlaceCategory => {
  if (!types) return 'restaurant';
  const match = types.find((t) => t === 'restaurant' || t === 'cafe' || t === 'bar' || t === 'park');
  return (match as PlaceCategory) ?? 'restaurant';
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

const mapResultToPlace = (result: NonNullable<PlacesSearchResponse['places']>[number], origin: Coordinates): Place | null => {
  const lat = result.location?.latitude;
  const lng = result.location?.longitude;
  if (lat == null || lng == null) return null;

  const category = mapTypesToCategory(result.types);
  const distanceMeters = haversineDistance(origin, { lat, lng });

  return {
    id: result.id ?? `${lat},${lng}`,
    name: result.displayName?.text ?? 'Unknown place',
    category,
    location: { lat, lng },
    rating: result.rating,
    travel: estimateTravel(distanceMeters),
    source: 'live',
  };
};

export type NearbyParams = {
  origin: Coordinates;
  apiKey: string;
  category?: PlaceCategory;
  radiusMeters?: number;
  maxResults?: number;
};

export const fetchGoogleNearby = async ({
  origin,
  apiKey,
  category,
  radiusMeters,
  maxResults,
}: NearbyParams): Promise<Place[]> => {
  const body = {
    includedTypes: category ? [categoryToIncludedType[category]] : undefined,
    maxResultCount: Math.min(maxResults ?? PLACES_MAX_RESULTS, PLACES_MAX_RESULTS),
    rankPreference: 'POPULARITY',
    locationRestriction: {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius: radiusMeters ?? PLACES_RADIUS_METERS,
      },
    },
  };

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.location,places.rating',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Places API error ${response.status}: ${message || response.statusText}`);
  }

  const data: PlacesSearchResponse = await response.json();
  const candidates = data.places ?? [];
  const capped = candidates.slice(0, maxResults ?? PLACES_MAX_RESULTS);

  return capped
    .map((result) => mapResultToPlace(result, origin))
    .filter((place): place is Place => Boolean(place));
};
