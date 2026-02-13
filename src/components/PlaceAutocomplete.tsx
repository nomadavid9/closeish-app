import React, { useEffect, useRef } from 'react';
import { loadGoogleMapsLibrary } from '../services/maps/googleMapsLoader';
import { Coordinates } from '../types/geo';

type PlaceAutocompleteProps = {
  apiKey: string;
  disabled?: boolean;
  placeholder?: string;
  onPlaceSelected: (selection: { label: string; coordinates: Coordinates }) => void;
  onError?: (message: string) => void;
};

type PlacePredictionEvent = Event & {
  placePrediction?: {
    toPlace: () => google.maps.places.Place;
  };
  detail?: {
    placePrediction?: {
      toPlace: () => google.maps.places.Place;
    };
  };
};

const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  apiKey,
  disabled = false,
  placeholder = 'Search address, landmark, or neighborhood',
  onPlaceSelected,
  onError,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const host = hostRef.current;
    if (!host) return;

    if (!apiKey) {
      onError?.('Origin search unavailable: missing Maps API key.');
      return;
    }

    let active = true;
    let element: HTMLElement | null = null;
    let listener: ((event: Event) => void) | null = null;

    const initialize = async () => {
      try {
        await loadGoogleMapsLibrary(apiKey, 'places');
        if (!active) return;

        element = document.createElement('gmp-place-autocomplete');
        element.setAttribute('placeholder', placeholder);
        host.replaceChildren(element);

        listener = async (event: Event) => {
          const placeEvent = event as PlacePredictionEvent;
          const prediction = placeEvent.placePrediction ?? placeEvent.detail?.placePrediction;
          if (!prediction) {
            onError?.('Could not read selected place prediction.');
            return;
          }

          try {
            const place = prediction.toPlace();
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location'],
            });

            const location = place.location;
            if (!location) {
              onError?.('Selected place did not include location coordinates.');
              return;
            }

            const label =
              place.formattedAddress ??
              place.displayName ??
              'Selected place';

            onPlaceSelected({
              label,
              coordinates: {
                lat: location.lat(),
                lng: location.lng(),
              },
            });
          } catch (error) {
            onError?.(`Failed to load place details: ${String(error)}`);
          }
        };

        element.addEventListener('gmp-select', listener);
      } catch (error) {
        onError?.(`Origin search initialization failed: ${String(error)}`);
      }
    };

    initialize();

    return () => {
      active = false;
      if (element && listener) {
        element.removeEventListener('gmp-select', listener);
      }
      host.replaceChildren();
    };
  }, [apiKey, disabled, onError, onPlaceSelected, placeholder]);

  return <div ref={hostRef} className={`place-autocomplete-host${disabled ? ' disabled' : ''}`} />;
};

export default PlaceAutocomplete;
