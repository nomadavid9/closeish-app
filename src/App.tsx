import React, { useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView';
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
import { scorePlace } from './services/scoring/closishScore';
import './App.css';

const App: React.FC = () => {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(filterDefaults);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);

  const config = useMemo(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    const mapId = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;

    return {
      apiKey,
      mapId,
      isConfigured: Boolean(apiKey && mapId),
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (error) => {
        setGeoError(`Error getting location: ${error.message}`);
      }
    );
  }, []);

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const loadPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const categoryMap = {
          restaurants: 'restaurant',
          cafes: 'cafe',
          bars: 'bar',
          parks: 'park',
        } as const;

        const results = await fetchMockPlaces({
          origin: position,
          categoryFilter: categoryMap[filters.placeType],
        });
        setPlaces(results);
        setSelectedPlaceId((prev) => prev && results.find((p) => p.id === prev) ? prev : null);
      } catch (error) {
        console.error('Error loading mock places', error);
        setPlaces([]);
      } finally {
        setLoadingPlaces(false);
      }
    };

    loadPlaces();
  }, [filters.placeType, position]);

  const scoredPlaces = useMemo(() => {
    const filtered = places.filter((place) => place.travel.walkMinutes <= filters.maxWalkMinutes + 10);
    const scored = filtered.map((place) => ({ place, score: scorePlace(place, filters) }));
    scored.sort((a, b) => b.score.closishScore - a.score.closishScore);
    return scored;
  }, [filters, places]);

  const selectedPlace = useMemo(
    () => (selectedPlaceId ? places.find((p) => p.id === selectedPlaceId) ?? null : null),
    [places, selectedPlaceId]
  );

  const renderMapState = () => {
    if (!config.isConfigured) {
      return (
        <div className="state-card error">
          <h3>Map not configured</h3>
          <p>
            Add <code>VITE_GOOGLE_MAPS_API_KEY</code> and <code>VITE_GOOGLE_MAP_ID</code> to your env.
          </p>
        </div>
      );
    }

    if (geoError) {
      return (
        <div className="state-card error">
          <h3>Location issue</h3>
          <p>{geoError}</p>
        </div>
      );
    }

    if (!position) {
      return (
        <div className="state-card">
          <h3>Requesting your location…</h3>
          <p>Allow location access to see the map centered on you.</p>
        </div>
      );
    }

    return <MapView position={position} apiKey={config.apiKey!} mapId={config.mapId!} selectedPlace={selectedPlace} />;
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
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filters</p>
              <h2>Tell us your vibe</h2>
              <p className="muted">Phase 2: controls are live locally; no API calls yet.</p>
            </div>
            <button
              type="button"
              className={`pill ${filters.liveMode ? 'live' : 'plan'}`}
              onClick={() => setFilter('liveMode', !filters.liveMode)}
            >
              {filters.liveMode ? 'Live mode' : 'Plan mode'}
            </button>
          </div>

          <div className="control-group">
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

          <div className="status-row">
            <div>
              <p className="label">Your coordinates</p>
              <p className="value">
                {position ? (
                  <>
                    {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                  </>
                ) : (
                  'Waiting for permission'
                )}
              </p>
            </div>
            <div>
              <p className="label">Filters</p>
              <p className="value">{filterSummary}</p>
            </div>
            <div>
              <p className="label">Config</p>
              <p className="value">{config.isConfigured ? 'Map keys loaded' : 'Missing map keys'}</p>
            </div>
          </div>

          <div className="list-panel">
            <div className="list-header">
              <h3>Nearby (mocked)</h3>
              {loadingPlaces ? <p className="note">Loading…</p> : <p className="note">Offline stub for ranking</p>}
            </div>
            {scoredPlaces.length === 0 && !loadingPlaces ? (
              <div className="empty">
                <p>No places found for these filters yet.</p>
              </div>
            ) : (
              <ul className="place-list">
                {scoredPlaces.map(({ place, score }) => (
                  <li
                    key={place.id}
                    className={`place-item ${selectedPlaceId === place.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPlaceId(place.id)}
                  >
                    <div className="place-main">
                      <p className="value">{place.name}</p>
                      <p className="note">{place.category} · score {score.closishScore.toFixed(0)}</p>
                    </div>
                    <div className="place-meta">
                      <span>{place.travel.transitMinutes}m transit</span>
                      <span>{place.travel.walkMinutes}m walk</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="map-shell">{renderMapState()}</section>
      </main>
    </div>
  );
};

export default App;
