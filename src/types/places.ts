import { Coordinates } from './geo';

export type PlaceCategory = 'restaurant' | 'cafe' | 'bar' | 'park';

export type TravelProxies = {
  walkMinutes: number;
  transitMinutes: number;
  driveMinutes: number;
};

export type TransitPathMetrics = {
  source: 'routes_api' | 'corridor_graph';
  totalMinutes?: number;
  inVehicleMinutes?: number;
  waitMinutes?: number;
  accessWalkMinutes?: number;
  transferWalkMinutes?: number;
  egressWalkMinutes?: number;
  transferCount?: number;
  transitLegCount?: number;
};

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  location: Coordinates;
  rating?: number;
  travel: TravelProxies;
  transitPath?: TransitPathMetrics;
  source?: 'mock' | 'live';
};

export type PlaceScore = {
  closishScore: number;
  components: {
    transitBias: number;
    walkPenalty: number;
    desirability: number;
    transferPenalty?: number;
    waitPenalty?: number;
    oneSeatBonus?: number;
  };
};
