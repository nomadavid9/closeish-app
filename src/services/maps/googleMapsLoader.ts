import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configuredApiKey: string | null = null;
let configured = false;

const ensureConfigured = (apiKey: string) => {
  if (!apiKey) return false;
  if (!configured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      libraries: ['marker', 'places'],
    });
    configuredApiKey = apiKey;
    configured = true;
    return true;
  }

  if (configuredApiKey !== apiKey) {
    console.warn('Google Maps loader already configured with a different API key; continuing with initial key.');
  }

  return true;
};

export const loadGoogleMapsLibrary = async (apiKey: string, library: 'maps' | 'marker' | 'places') => {
  if (!ensureConfigured(apiKey)) {
    throw new Error('Missing Maps API key.');
  }
  return importLibrary(library);
};
