import { Coordinates } from './geo';

export type TransitMode = 'rail' | 'light_rail' | 'bus' | 'tram' | 'ferry' | 'cable_car' | 'other';

export type TransitStop = {
  id: string;           // Transitland onestop_id
  name: string;
  location: Coordinates;
};

export type TransitRoute = {
  id: string;           // Transitland onestop_id
  name: string;         // route_short_name or route_long_name
  mode: TransitMode;
  agencyName: string;
};

export type TransitRouteWithStops = TransitRoute & {
  // Stops in order, for a given direction. Transitland returns two headways_secs
  // sets (outbound=0, inbound=1); we store each direction separately.
  directions: TransitDirection[];
};

export type TransitDirection = {
  directionId: 0 | 1;   // 0 = outbound, 1 = inbound (GTFS convention)
  headsign: string;
  stops: TransitStop[];
};
