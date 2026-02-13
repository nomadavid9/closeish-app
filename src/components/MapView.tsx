import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

const DEFAULT_ORIGIN_ZOOM = 15;
const CAMERA_PADDING_PX = 72;
const DEFAULT_UI_PADDING = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

const clampLatitude = (lat: number) => Math.max(-85, Math.min(85, lat));

const normalizeLongitude = (lng: number) => {
  if (!Number.isFinite(lng)) return lng;
  return ((lng + 540) % 360) - 180;
};

const buildMirroredPoint = (origin: Coordinates, destination: Coordinates): Coordinates => ({
  lat: clampLatitude(origin.lat + (origin.lat - destination.lat)),
  lng: normalizeLongitude(origin.lng + (origin.lng - destination.lng)),
});

type ViewPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type MapCameraMode = 'origin_locked' | 'follow_selection';

export type MapViewProps = {
  origin: Coordinates;
  currentLocation?: Coordinates | null;
  usingOriginOverride?: boolean;
  cameraMode?: MapCameraMode;
  uiPadding?: ViewPadding;
  mapId: string;
  selectedPlace?: Place | null;
  isLoaded: boolean;
};

const MapView: React.FC<MapViewProps> = ({
  origin,
  currentLocation,
  usingOriginOverride = false,
  cameraMode = 'origin_locked',
  uiPadding = DEFAULT_UI_PADDING,
  mapId,
  selectedPlace,
  isLoaded,
}) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!mapInstance || !isLoaded) return;

    if (!selectedPlace) {
      mapInstance.moveCamera({
        center: origin,
        zoom: DEFAULT_ORIGIN_ZOOM,
      });
      return;
    }

    if (cameraMode === 'follow_selection') {
      mapInstance.panTo(selectedPlace.location);
      return;
    }

    const destination = selectedPlace.location;
    const bounds = new google.maps.LatLngBounds();
    const mirroredPoint = buildMirroredPoint(origin, destination);
    bounds.extend(destination);
    bounds.extend(mirroredPoint);

    mapInstance.fitBounds(bounds, {
      top: uiPadding.top + CAMERA_PADDING_PX,
      right: uiPadding.right + CAMERA_PADDING_PX,
      bottom: uiPadding.bottom + CAMERA_PADDING_PX,
      left: uiPadding.left + CAMERA_PADDING_PX,
    });

    const destinationLatLng = new google.maps.LatLng(destination.lat, destination.lng);
    const ensureDestinationVisible = () => {
      const currentBounds = mapInstance.getBounds();
      if (currentBounds?.contains(destinationLatLng)) return;

      const zoom = mapInstance.getZoom();
      if (zoom == null || zoom <= 2) return;

      mapInstance.moveCamera({
        center: origin,
        zoom: zoom - 1,
      });
      google.maps.event.addListenerOnce(mapInstance, 'idle', ensureDestinationVisible);
    };

    google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      mapInstance.moveCamera({ center: origin });
      google.maps.event.addListenerOnce(mapInstance, 'idle', ensureDestinationVisible);
    });
  }, [mapInstance, isLoaded, origin, selectedPlace, cameraMode, uiPadding]);

  useEffect(() => {
    if (!mapInstance || !isLoaded) return;

    const loadMarkers = async () => {
      try {
        const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((m) => m.map = null);
        markersRef.current = [];

        const originMarker = new AdvancedMarkerElement({
          map: mapInstance,
          position: origin,
          title: usingOriginOverride ? 'Selected origin' : 'Current location',
        });
        markersRef.current.push(originMarker);

        if (usingOriginOverride && currentLocation) {
          const devicePin = new PinElement({
            background: '#64748b',
            borderColor: '#475569',
            glyphColor: '#ffffff',
            glyph: 'D',
          });
          const currentLocationMarker = new AdvancedMarkerElement({
            map: mapInstance,
            position: currentLocation,
            title: 'Device location',
            content: devicePin.element,
          });
          markersRef.current.push(currentLocationMarker);
        }

        if (selectedPlace) {
          const placePin = new PinElement({
            background: '#34A853',
            borderColor: '#188038',
            glyphColor: '#ffffff',
            glyph: '●',
            scale: 1.05,
          });
          const selectionMarker = new AdvancedMarkerElement({
            map: mapInstance,
            position: selectedPlace.location,
            title: selectedPlace.name,
            content: placePin.element,
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
