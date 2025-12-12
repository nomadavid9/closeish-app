import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';
import { Place } from '../types/places';

const libraries: ('places' | 'marker')[] = ['places', 'marker'];

export type MapViewProps = {
  position: Coordinates;
  apiKey: string;
  mapId: string;
  selectedPlace?: Place | null;
};

const MapView: React.FC<MapViewProps> = ({ position, apiKey, mapId, selectedPlace }) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!position || !mapInstance) return;

    const loadMarkers = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((m) => m.map = null);
        markersRef.current = [];

        mapInstance.setCenter(position);

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
  }, [position, mapInstance, selectedPlace]);

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries} version="beta">
      <GoogleMap
        mapContainerClassName="map-container"
        center={position}
        zoom={15}
        options={{ mapId }}
        onLoad={setMapInstance}
      />
    </LoadScript>
  );
};

export default MapView;
