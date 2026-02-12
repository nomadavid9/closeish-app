import { TRANSIT_ENRICH_TOP_N } from '../../config/dataSources';
import { Coordinates } from '../../types/geo';
import { Place, TransitPathMetrics } from '../../types/places';

type RoutesStep = {
  travelMode?: string;
  staticDuration?: string;
  duration?: string;
};

type RoutesLeg = {
  steps?: RoutesStep[];
};

type RoutesCandidate = {
  duration?: string;
  legs?: RoutesLeg[];
};

type ComputeRoutesResponse = {
  routes?: RoutesCandidate[];
};

type TransitRouteSummary = {
  totalMinutes: number;
  inVehicleMinutes: number;
  waitMinutes: number;
  accessWalkMinutes: number;
  transferWalkMinutes: number;
  egressWalkMinutes: number;
  transferCount: number;
  transitLegCount: number;
};

export type EnrichPlacesWithTransitParams = {
  origin: Coordinates;
  places: Place[];
  apiKey: string;
  maxPlaces?: number;
  departureTime?: string;
};

const parseDurationSeconds = (value?: string): number | null => {
  if (!value) return null;
  const normalized = value.endsWith('s') ? value.slice(0, -1) : value;
  const seconds = Number(normalized);
  return Number.isFinite(seconds) ? seconds : null;
};

const toMinutes = (seconds: number): number => {
  if (seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
};

const summarizeTransitRoute = (route: RoutesCandidate): TransitRouteSummary | null => {
  const steps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []);
  if (steps.length === 0) return null;

  const normalized = steps.map((step) => ({
    mode: step.travelMode?.toUpperCase() ?? '',
    seconds: parseDurationSeconds(step.staticDuration ?? step.duration) ?? 0,
  }));

  const transitIndices = normalized
    .map((step, index) => ({ mode: step.mode, index }))
    .filter((entry) => entry.mode === 'TRANSIT')
    .map((entry) => entry.index);

  if (transitIndices.length === 0) return null;

  const firstTransitIndex = transitIndices[0];
  const lastTransitIndex = transitIndices[transitIndices.length - 1];

  let accessWalkSeconds = 0;
  let transferWalkSeconds = 0;
  let egressWalkSeconds = 0;
  let inVehicleSeconds = 0;

  normalized.forEach((step, index) => {
    if (step.mode === 'TRANSIT') {
      inVehicleSeconds += step.seconds;
      return;
    }

    if (step.mode !== 'WALK') return;

    if (index < firstTransitIndex) {
      accessWalkSeconds += step.seconds;
    } else if (index > lastTransitIndex) {
      egressWalkSeconds += step.seconds;
    } else {
      transferWalkSeconds += step.seconds;
    }
  });

  const stepTotalSeconds = normalized.reduce((sum, step) => sum + step.seconds, 0);
  const routeDurationSeconds = parseDurationSeconds(route.duration) ?? stepTotalSeconds;
  if (routeDurationSeconds <= 0) return null;

  const walkSeconds = accessWalkSeconds + transferWalkSeconds + egressWalkSeconds;
  const waitSeconds = Math.max(routeDurationSeconds - inVehicleSeconds - walkSeconds, 0);

  return {
    totalMinutes: toMinutes(routeDurationSeconds),
    inVehicleMinutes: toMinutes(inVehicleSeconds),
    waitMinutes: toMinutes(waitSeconds),
    accessWalkMinutes: toMinutes(accessWalkSeconds),
    transferWalkMinutes: toMinutes(transferWalkSeconds),
    egressWalkMinutes: toMinutes(egressWalkSeconds),
    transferCount: Math.max(0, transitIndices.length - 1),
    transitLegCount: transitIndices.length,
  };
};

const fetchTransitSummary = async ({
  origin,
  destination,
  apiKey,
  departureTime,
}: {
  origin: Coordinates;
  destination: Coordinates;
  apiKey: string;
  departureTime?: string;
}): Promise<TransitRouteSummary | null> => {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.duration',
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: false,
      departureTime: departureTime ?? new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Routes API error ${response.status}`);
  }

  const data: ComputeRoutesResponse = await response.json();
  const primaryRoute = data.routes?.[0];
  if (!primaryRoute) return null;

  return summarizeTransitRoute(primaryRoute);
};

export const enrichPlacesWithTransit = async ({
  origin,
  places,
  apiKey,
  maxPlaces,
  departureTime,
}: EnrichPlacesWithTransitParams): Promise<Place[]> => {
  const limit = Math.min(Math.max(maxPlaces ?? TRANSIT_ENRICH_TOP_N, 0), places.length);
  if (limit === 0) return places;

  const targetPlaces = places.slice(0, limit);

  const summaries = await Promise.all(
    targetPlaces.map(async (place) => {
      try {
        const summary = await fetchTransitSummary({
          origin,
          destination: place.location,
          apiKey,
          departureTime,
        });

        return { placeId: place.id, summary };
      } catch (error) {
        console.warn(`Transit enrichment failed for ${place.id}`, error);
        return { placeId: place.id, summary: null };
      }
    })
  );

  const summaryById = new Map<string, TransitRouteSummary>();
  summaries.forEach(({ placeId, summary }) => {
    if (!summary) return;
    summaryById.set(placeId, summary);
  });

  return places.map((place) => {
    const summary = summaryById.get(place.id);
    if (!summary) return place;

    const transitPath: TransitPathMetrics = {
      source: 'routes_api',
      totalMinutes: summary.totalMinutes,
      inVehicleMinutes: summary.inVehicleMinutes,
      waitMinutes: summary.waitMinutes,
      accessWalkMinutes: summary.accessWalkMinutes,
      transferWalkMinutes: summary.transferWalkMinutes,
      egressWalkMinutes: summary.egressWalkMinutes,
      transferCount: summary.transferCount,
      transitLegCount: summary.transitLegCount,
    };

    return {
      ...place,
      travel: {
        ...place.travel,
        transitMinutes: summary.totalMinutes,
      },
      transitPath,
    };
  });
};
