import { Loader, type Library } from '@googlemaps/js-api-loader';

const MAP_LIBRARIES: Library[] = ['marker', 'places'];

let loaderInstance: Loader | null = null;

export const getGoogleMapsLoader = (apiKey: string) => {
  if (!apiKey) return null;
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey,
      version: 'weekly',
      libraries: MAP_LIBRARIES,
    });
  }
  return loaderInstance;
};
