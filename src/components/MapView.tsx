import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

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

    const loadMarkers = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((m) => m.map = null);
        markersRef.current = [];

        const focus = selectedPlace?.location ?? origin;
        mapInstance.setCenter(focus);

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
      zoom={15}
      options={{ mapId }}
      onLoad={setMapInstance}
    />
  );
};

export default MapView;
