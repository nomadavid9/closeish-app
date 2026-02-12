import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

export type MapViewProps = {
  position: Coordinates;
  mapId: string;
  selectedPlace?: Place | null;
  isLoaded: boolean;
};

const MapView: React.FC<MapViewProps> = ({ position, mapId, selectedPlace, isLoaded }) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!position || !mapInstance || !isLoaded) return;

    const loadMarkers = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((m) => m.map = null);
        markersRef.current = [];

        const focus = selectedPlace?.location ?? position;
        mapInstance.setCenter(focus);

        const userMarker = new AdvancedMarkerElement({
          map: mapInstance,
          position,
          title: 'You are here',
        });
        markersRef.current.push(userMarker);

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
  }, [position, mapInstance, selectedPlace, isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <GoogleMap
      mapContainerClassName="map-container"
      center={position}
      zoom={15}
      options={{ mapId }}
      onLoad={setMapInstance}
    />
  );
};

export default MapView;
