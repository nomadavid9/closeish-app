import { Coordinates } from '../../types/geo';
import { Place, PlaceCategory } from '../../types/places';

const MOCK_PLACES: Place[] = [
  {
    id: 'p1',
    name: 'Orange Line Cafe',
    category: 'cafe',
    location: { lat: 37.776, lng: -122.417 },
    rating: 4.5,
    travel: { walkMinutes: 10, transitMinutes: 8, driveMinutes: 6 },
    source: 'mock',
  },
  {
    id: 'p2',
    name: 'Strong Towns Park',
    category: 'park',
    location: { lat: 37.78, lng: -122.412 },
    rating: 4.2,
    travel: { walkMinutes: 14, transitMinutes: 9, driveMinutes: 8 },
    source: 'mock',
  },
  {
    id: 'p3',
    name: 'Not Just Bikes Bar',
    category: 'bar',
    location: { lat: 37.772, lng: -122.423 },
    rating: 4.7,
    travel: { walkMinutes: 18, transitMinutes: 12, driveMinutes: 10 },
    source: 'mock',
  },
  {
    id: 'p4',
    name: 'Market Street Eats',
    category: 'restaurant',
    location: { lat: 37.785, lng: -122.418 },
    rating: 4.3,
    travel: { walkMinutes: 12, transitMinutes: 10, driveMinutes: 7 },
    source: 'mock',
  },
];

export type FetchMockPlacesParams = {
  origin: Coordinates | null;
  categoryFilter?: PlaceCategory;
};

export const fetchMockPlaces = ({ categoryFilter }: FetchMockPlacesParams): Promise<Place[]> => {
  const filtered = categoryFilter
    ? MOCK_PLACES.filter((place) => place.category === categoryFilter)
    : MOCK_PLACES;

  return Promise.resolve(filtered);
};
