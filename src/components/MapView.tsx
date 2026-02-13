import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

const DEFAULT_ORIGIN_ZOOM = 15;
const CAMERA_PADDING_PX = 72;

const clampLatitude = (lat: number) => Math.max(-85, Math.min(85, lat));

const normalizeLongitude = (lng: number) => {
  if (!Number.isFinite(lng)) return lng;
  return ((lng + 540) % 360) - 180;
};

const buildMirroredPoint = (origin: Coordinates, destination: Coordinates): Coordinates => ({
  lat: clampLatitude(origin.lat + (origin.lat - destination.lat)),
  lng: normalizeLongitude(origin.lng + (origin.lng - destination.lng)),
});

export type MapViewProps = {
  origin: Coordinates;
  currentLocation?: Coordinates | null;
  usingOriginOverride?: boolean;
  mapId: string;
  selectedPlace?: Place | null;
  isLoaded: boolean;
};

const MapView: React.FC<MapViewProps> = ({
  origin,
  currentLocation,
  usingOriginOverride = false,
  mapId,
  selectedPlace,
  isLoaded,
}) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!mapInstance || !isLoaded) return;

    if (!selectedPlace) {
      mapInstance.setCenter(origin);
      mapInstance.setZoom(DEFAULT_ORIGIN_ZOOM);
      return;
    }

    const destination = selectedPlace.location;
    const bounds = new google.maps.LatLngBounds();
    const mirroredPoint = buildMirroredPoint(origin, destination);
    bounds.extend(destination);
    bounds.extend(mirroredPoint);

    mapInstance.fitBounds(bounds, {
      top: CAMERA_PADDING_PX,
      right: CAMERA_PADDING_PX,
      bottom: CAMERA_PADDING_PX,
      left: CAMERA_PADDING_PX,
    });

    google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      mapInstance.setCenter(origin);
    });
  }, [mapInstance, isLoaded, origin, selectedPlace]);

  useEffect(() => {
    if (!mapInstance || !isLoaded) return;

    const loadMarkers = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((m) => m.map = null);
        markersRef.current = [];

        const originMarker = new AdvancedMarkerElement({
          map: mapInstance,
          position: origin,
          title: usingOriginOverride ? 'Selected origin' : 'Current location',
        });
        markersRef.current.push(originMarker);

        if (usingOriginOverride && currentLocation) {
          const currentLocationMarker = new AdvancedMarkerElement({
            map: mapInstance,
            position: currentLocation,
            title: 'Device location',
          });
          markersRef.current.push(currentLocationMarker);
        }

        if (selectedPlace) {
          const selectionMarker = new AdvancedMarkerElement({
            map: mapInstance,
            position: selectedPlace.location,
            title: selectedPlace.name,
          });
          markersRef.current.push(selectionMarker);
        }
      } catch (error) {
        console.error('Error loading AdvancedMarkerElement:', error);
      }
    };

    loadMarkers();
  }, [origin, currentLocation, usingOriginOverride, mapInstance, selectedPlace, isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <GoogleMap
      mapContainerClassName="map-container"
      center={origin}
      zoom={DEFAULT_ORIGIN_ZOOM}
      options={{ mapId }}
      onLoad={setMapInstance}
    />
  );
};

export default MapView;
