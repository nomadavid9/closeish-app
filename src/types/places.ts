import { Coordinates } from './geo';

export type PlaceCategory = 'restaurant' | 'cafe' | 'bar' | 'park';

export type TravelProxies = {
  walkMinutes: number;
  transitMinutes: number;
  driveMinutes: number;
};

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  location: Coordinates;
  rating?: number;
  travel: TravelProxies;
};

export type PlaceScore = {
  closishScore: number;
  components: {
    transitBias: number;
    walkPenalty: number;
    desirability: number;
  };
};
