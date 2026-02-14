import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView';
import PlaceAutocomplete from './components/PlaceAutocomplete';
import PlaceCard from './components/PlaceCard';
import { Coordinates } from './types/geo';
import {
  FilterState,
  filterDefaults,
  placeTypeOptions,
  timeWindowOptions,
  walkVsTransitOptions,
} from './types/filters';
import { Place } from './types/places';
import { fetchMockPlaces } from './services/places/mockPlaces';
import { fetchGoogleNearby } from './services/places/googlePlaces';
import { enrichPlacesWithTransit } from './services/transit/googleRoutes';
import { scorePlace } from './services/scoring/closishScore';
import { PLACES_TOP_K, TRANSIT_ENRICH_TOP_N } from './config/dataSources';
import { loadGoogleMapsLibrary } from './services/maps/googleMapsLoader';
import './App.css';

type OriginOverride = {
  label: string;
  coordinates: Coordinates;
};

const App: React.FC = () => {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [requestingGeolocation, setRequestingGeolocation] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [originOverride, setOriginOverride] = useState<OriginOverride | null>(null);
  const [originError, setOriginError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(filterDefaults);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);
  const [placesSource, setPlacesSource] = useState<'mock' | 'live'>('mock');
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [enrichmentNotice, setEnrichmentNotice] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMapFocused, setIsMapFocused] = useState<boolean>(false);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const config = useMemo(() => {
    const mapApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    const mapId = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;
    const placesApiKey =
      (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined) ??
      (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined);
    const routesApiKey =
      (import.meta.env.VITE_GOOGLE_ROUTES_API_KEY as string | undefined) ??
      (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined);

    return {
      mapApiKey,
      mapId,
      placesApiKey,
      routesApiKey,
      isMapConfigured: Boolean(mapApiKey && mapId),
      isPlacesConfigured: Boolean(placesApiKey),
      isRoutesConfigured: Boolean(routesApiKey),
    };
  }, []);

  useEffect(() => {
    if (!config.mapApiKey) return;
    let active = true;
    loadGoogleMapsLibrary(config.mapApiKey, 'maps')
      .then(() => {
        if (!active) return;
        setIsLoaded(true);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setIsLoaded(false);
        setLoadError(String(error));
      });

    return () => {
      active = false;
    };
  }, [config.mapApiKey]);

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeOrigin = useMemo(
    () => originOverride?.coordinates ?? position ?? null,
    [originOverride, position]
  );

  const clearOriginOverride = useCallback(() => {
    setOriginOverride(null);
    setOriginError(null);
    setSelectedPlaceId(null);
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }

    setRequestingGeolocation(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginOverride(null);
        setOriginError(null);
        setSelectedPlaceId(null);
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setRequestingGeolocation(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. You can continue by searching an origin.'
            : `Error getting location: ${error.message}`;
        setGeoError(message);
        setRequestingGeolocation(false);
      }
    );
  }, []);

  const handleOriginSelected = useCallback((selection: { label: string; coordinates: Coordinates }) => {
    setOriginOverride(selection);
    setOriginError(null);
    setGeoError(null);
    setSelectedPlaceId(null);
  }, []);

  const handlePlaceCardSelect = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (position) {
      clearOriginOverride();
      return;
    }
    requestCurrentLocation();
  }, [position, requestCurrentLocation, clearOriginOverride]);

  useEffect(() => {
    if (!activeOrigin) return;

    const shouldUseLive = Boolean(filters.liveMode && config.isPlacesConfigured);
    const categoryMap = {
      restaurants: 'restaurant',
      cafes: 'cafe',
      bars: 'bar',
      parks: 'park',
    } as const;

    const loadPlaces = async () => {
      setLoadingPlaces(true);
      setPlacesError(null);
      setEnrichmentNotice(null);
      try {
        if (shouldUseLive && config.placesApiKey) {
          try {
            const liveResults = await fetchGoogleNearby({
              origin: activeOrigin,
              category: categoryMap[filters.placeType],
              apiKey: config.placesApiKey,
            });

            let placesForRanking = liveResults;
            if (config.routesApiKey) {
              try {
                const enrichmentSeed = [...liveResults].sort((a, b) => {
                  const ratingDelta = (b.rating ?? 0) - (a.rating ?? 0);
                  if (ratingDelta !== 0) return ratingDelta;
                  return a.travel.transitMinutes - b.travel.transitMinutes;
                });

                const enrichedPlaces = await enrichPlacesWithTransit({
                  origin: activeOrigin,
                  places: enrichmentSeed,
                  apiKey: config.routesApiKey,
                  maxPlaces: TRANSIT_ENRICH_TOP_N,
                });

                const enrichedById = new Map(enrichedPlaces.filter((place) => place.transitPath).map((place) => [place.id, place]));
                placesForRanking = liveResults.map((place) => enrichedById.get(place.id) ?? place);
                const enrichmentCandidates = Math.min(TRANSIT_ENRICH_TOP_N, liveResults.length);
                if (enrichedById.size < enrichmentCandidates) {
                  setEnrichmentNotice(`Transit detail enrichment available for ${enrichedById.size}/${enrichmentCandidates} top candidates.`);
                }
              } catch (error) {
                console.warn('Transit enrichment failed; using baseline scoring', error);
                setEnrichmentNotice('Transit detail enrichment is unavailable right now; showing baseline trip estimates.');
              }
            } else {
              setEnrichmentNotice('Routes API key missing; showing baseline trip estimates.');
            }

            setPlaces(placesForRanking);
            setPlacesSource('live');
            setSelectedPlaceId((prev) => prev && placesForRanking.find((p) => p.id === prev) ? prev : null);
            return;
          } catch (error) {
            console.warn('Live places failed, falling back to mock', error);
            setPlacesError('Live data unavailable, showing mock results.');
          }
        } else if (filters.liveMode && !config.isPlacesConfigured) {
          setPlacesError('Places API key missing; showing mock results.');
        }

        const mockResults = await fetchMockPlaces({
          origin: activeOrigin,
          categoryFilter: categoryMap[filters.placeType],
        });
        setEnrichmentNotice(null);
        setPlaces(mockResults);
        setPlacesSource('mock');
        setSelectedPlaceId((prev) => prev && mockResults.find((p) => p.id === prev) ? prev : null);
      } catch (error) {
        console.error('Error loading mock places', error);
        setEnrichmentNotice(null);
        setPlaces([]);
        setPlacesSource('mock');
      } finally {
        setLoadingPlaces(false);
      }
    };

    loadPlaces();
  }, [filters.liveMode, filters.placeType, activeOrigin, config.isPlacesConfigured, config.placesApiKey, config.routesApiKey]);

  const scoredPlaces = useMemo(() => {
    const filtered = places.filter((place) => place.travel.walkMinutes <= filters.maxWalkMinutes + 10);
    const scored = filtered.map((place) => ({ place, score: scorePlace(place, filters) }));
    scored.sort((a, b) => b.score.closishScore - a.score.closishScore);
    return scored.slice(0, PLACES_TOP_K);
  }, [filters, places]);

  const selectedPlace = useMemo(
    () => (selectedPlaceId ? places.find((p) => p.id === selectedPlaceId) ?? null : null),
    [places, selectedPlaceId]
  );

  const selectedTripMinutes = useMemo(() => {
    if (!selectedPlace) return null;
    return selectedPlace.transitPath?.totalMinutes ?? selectedPlace.travel.transitMinutes + selectedPlace.travel.walkMinutes;
  }, [selectedPlace]);

  const renderMapState = () => {
    if (!config.isMapConfigured) {
      return (
        <div className="state-card error">
          <h3>Map not configured</h3>
          <p>
            Add <code>VITE_GOOGLE_MAPS_API_KEY</code> and <code>VITE_GOOGLE_MAP_ID</code> to your env.
          </p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="state-card error">
          <h3>Map load issue</h3>
          <p>{loadError}</p>
        </div>
      );
    }

    if (!isLoaded) {
      return (
        <div className="state-card">
          <h3>Loading map…</h3>
          <p>Fetching map libraries.</p>
        </div>
      );
    }

    if (geoError && !activeOrigin) {
      return (
        <div className="state-card error">
          <h3>Location issue</h3>
          <p>{geoError}</p>
        </div>
      );
    }

    if (!activeOrigin) {
      return (
        <div className="state-card">
          <h3>Set an origin</h3>
          <p>Allow location access or search an origin to center the map.</p>
        </div>
      );
    }

    return (
      <MapView
        origin={activeOrigin}
        currentLocation={position}
        usingOriginOverride={Boolean(originOverride)}
        mapId={config.mapId!}
        selectedPlace={selectedPlace}
        isLoaded={isLoaded}
      />
    );
  };

  const filterSummary = useMemo(() => {
    const placeLabel = placeTypeOptions.find((opt) => opt.value === filters.placeType)?.label ?? 'Any place';
    const walkLabel = walkVsTransitOptions.find((opt) => opt.value === filters.walkVsTransit)?.label ?? '';
    const timeLabel =
      filters.when === 'now'
        ? 'Now'
        : timeWindowOptions.find((opt) => opt.value === filters.timeWindow)?.label ?? 'Later';

    return `${filters.liveMode ? 'Live' : 'Plan'} · ${placeLabel} · ${timeLabel} · ${walkLabel} · Max walk ${filters.maxWalkMinutes} min`;
  }, [filters]);

  const usingCurrentLocation = Boolean(position && !originOverride);
  const originInputDisabled = !isLoaded || Boolean(loadError) || !config.isMapConfigured;
  const originStatusMessage = useMemo(() => {
    if (requestingGeolocation) return 'Requesting your current location…';
    if (!config.isMapConfigured) return 'Origin search unavailable: add Maps API key and Map ID.';
    if (loadError) return 'Origin search unavailable: map libraries failed to load.';
    if (!isLoaded) return 'Loading map libraries for origin search…';
    return null;
  }, [config.isMapConfigured, isLoaded, loadError, requestingGeolocation]);
  const originStatusTone = !config.isMapConfigured || Boolean(loadError) ? 'note error' : 'note';
  const resultsStatusMessage = useMemo(() => {
    if (loadingPlaces) return 'Loading places…';
    if (placesError) return placesError;
    if (scoredPlaces.length === 0) return 'No places found for these filters yet.';
    return 'Ranked locally; top candidates only.';
  }, [loadingPlaces, placesError, scoredPlaces.length]);
  const resultsStatusTone = placesError ? 'note error' : 'note';
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!isMapFocused) return;
    mapSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [isMapFocused, prefersReducedMotion]);

  if (!activeOrigin) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="eyebrow">Closeish.app</p>
            <h1>Transit-first discovery</h1>
            <p className="tagline">Find places that are unexpectedly easy to reach by transit.</p>
          </div>
        </header>

        <main className="landing-main">
          <section className="landing-card">
            <p className="eyebrow">Start Here</p>
            <h2>Choose your origin</h2>
            <p className="muted">Search any place or use your current location to begin discovery.</p>

            <div className="landing-search">
              <PlaceAutocomplete
                apiKey={config.mapApiKey ?? ''}
                disabled={originInputDisabled}
                onPlaceSelected={handleOriginSelected}
                onError={setOriginError}
              />
            </div>

            <button
              type="button"
              className="pill live landing-location-cta"
              onClick={requestCurrentLocation}
              disabled={requestingGeolocation}
            >
              {requestingGeolocation ? 'Locating…' : 'Use my location'}
            </button>

            {originError ? <p className="note error">{originError}</p> : null}
            {geoError ? <p className="note error">{geoError}</p> : null}
            {originStatusMessage ? <p className={originStatusTone}>{originStatusMessage}</p> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Closeish.app</p>
          <h1>Transit-first discovery</h1>
          <p className="tagline">Find places that are unexpectedly easy to reach by transit.</p>
        </div>
      </header>

      <main className="app-body">
        <section className="panel intent-panel">
          <div className="panel-header panel-header-centered">
            <p className="eyebrow">Filters</p>
            <h2>Tell us your vibe</h2>
            <p className="muted">Phase 4: live data when available, with mock fallback to stay fast.</p>
            <button
              type="button"
              className={`pill ${filters.liveMode ? 'live' : 'plan'} panel-mode-toggle`}
              onClick={() => setFilter('liveMode', !filters.liveMode)}
            >
              {filters.liveMode ? 'Live mode' : 'Plan mode'}
            </button>
          </div>

          <div className="control-group control-group-origin">
            <div className="control">
              <p className="label">Origin</p>
              <PlaceAutocomplete
                apiKey={config.mapApiKey ?? ''}
                disabled={originInputDisabled}
                onPlaceSelected={handleOriginSelected}
                onError={setOriginError}
              />
              <div className="origin-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={handleUseCurrentLocation}
                  disabled={requestingGeolocation || usingCurrentLocation}
                >
                  {requestingGeolocation ? 'Locating…' : 'Use current location'}
                </button>
                <p className="note">
                  {originOverride ? `Override: ${originOverride.label}` : 'Default: current geolocation'}
                </p>
              </div>
              {originError ? <p className="note error">{originError}</p> : null}
              {geoError ? <p className="note error">{geoError}</p> : null}
              {originStatusMessage ? <p className={originStatusTone}>{originStatusMessage}</p> : null}
            </div>
          </div>

          <div className="control-group control-group-preferences">
            <div className="control">
              <p className="label">Place type</p>
              <select
                className="input"
                value={filters.placeType}
                onChange={(e) => setFilter('placeType', e.target.value as FilterState['placeType'])}
              >
                {placeTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="control">
              <p className="label">When</p>
              <div className="chip-group">
                {(['now', 'later'] as FilterState['when'][]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${filters.when === value ? 'selected' : ''}`}
                    onClick={() => setFilter('when', value)}
                  >
                    {value === 'now' ? 'Now' : 'Plan ahead'}
                  </button>
                ))}
              </div>
              {filters.when === 'later' && (
                <select
                  className="input"
                  value={filters.timeWindow}
                  onChange={(e) => setFilter('timeWindow', e.target.value as FilterState['timeWindow'])}
                >
                  {timeWindowOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="control">
              <p className="label">Walk vs transit</p>
              <div className="chip-group">
                {walkVsTransitOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip ${filters.walkVsTransit === opt.value ? 'selected' : ''}`}
                    onClick={() => setFilter('walkVsTransit', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control">
              <p className="label">Max walking minutes</p>
              <input
                className="input"
                type="range"
                min={5}
                max={30}
                step={5}
                value={filters.maxWalkMinutes}
                onChange={(e) => setFilter('maxWalkMinutes', Number(e.target.value))}
              />
              <p className="note">Currently: {filters.maxWalkMinutes} min</p>
            </div>
          </div>
        </section>

        <details className="status-disclosure">
          <summary>Selection and trip summary</summary>
          <div className="status-row">
            <div>
              <p className="label">Active origin</p>
              <p className="value">
                {activeOrigin ? (
                  <>
                    {activeOrigin.lat.toFixed(5)}, {activeOrigin.lng.toFixed(5)}
                  </>
                ) : (
                  'Waiting for location or override'
                )}
              </p>
              <p className="note">
                {originOverride ? 'Source: override' : activeOrigin ? 'Source: geolocation' : 'Source: pending'}
              </p>
            </div>
            <div>
              <p className="label">Device coordinates</p>
              <p className="value">
                {position ? (
                  <>
                    {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                  </>
                ) : (
                  'Unavailable'
                )}
              </p>
            </div>
            <div>
              <p className="label">Filters</p>
              <p className="value">{filterSummary}</p>
            </div>
            <div>
              <p className="label">Config</p>
              <p className="value">
                Map: {config.isMapConfigured ? 'ready' : 'missing'} · Places: {config.isPlacesConfigured ? 'ready' : 'missing'} ·
                Routes: {config.isRoutesConfigured ? 'ready' : 'optional'}
              </p>
            </div>
            <div>
              <p className="label">Selected place</p>
              <p className="value">{selectedPlace ? selectedPlace.name : 'None selected yet'}</p>
              <p className="note">{selectedPlace ? `${selectedTripMinutes ?? 'N/A'} min total trip` : 'Tap any card to inspect a trip.'}</p>
            </div>
          </div>
        </details>

        <section ref={mapSectionRef} className="map-section">
          <div className="map-toolbar">
            <div>
              <p className="label">Map</p>
              <p className="note">
                {selectedPlace ? `Focused on ${selectedPlace.name}` : 'Select a place card to update the destination marker.'}
              </p>
            </div>
            <button
              type="button"
              className={`chip ${isMapFocused ? 'selected' : ''}`}
              onClick={() => setIsMapFocused((prev) => !prev)}
              aria-pressed={isMapFocused}
              aria-label={isMapFocused ? 'Exit focused map mode' : 'Enter focused map mode'}
              aria-controls="main-map-surface"
            >
              {isMapFocused ? 'Exit focused map' : 'Focus map'}
            </button>
          </div>
          <div id="main-map-surface" className={`map-shell${isMapFocused ? ' focused' : ''}`}>{renderMapState()}</div>
        </section>

        <section className="list-panel">
          <div className="list-header">
            <div className="list-title">
              <h3>Nearby ({placesSource === 'live' ? 'live' : 'mock'})</h3>
              <span className={`badge ${placesSource === 'live' ? 'badge-live' : 'badge-mock'}`}>
                {placesSource === 'live' ? 'Live data' : 'Mock data'}
              </span>
            </div>
            <p id="results-status" className={resultsStatusTone} aria-live="polite">{resultsStatusMessage}</p>
          </div>
          {enrichmentNotice ? <p className="note warning" aria-live="polite">{enrichmentNotice}</p> : null}
          {scoredPlaces.length === 0 && !loadingPlaces ? (
            <div className="empty">
              <p>No places found for these filters yet.</p>
            </div>
          ) : (
            <ul className="place-grid" aria-label="Ranked places" aria-describedby="results-status">
              {scoredPlaces.map(({ place, score }) => {
                return (
                  <li key={place.id} className="place-grid-item">
                    <PlaceCard
                      place={place}
                      closishScore={score.closishScore}
                      selected={selectedPlaceId === place.id}
                      onSelect={handlePlaceCardSelect}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
