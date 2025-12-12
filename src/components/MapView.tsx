import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';

const libraries: ('places' | 'marker')[] = ['places', 'marker'];

export type MapViewProps = {
  position: Coordinates;
  apiKey: string;
  mapId: string;
};

const MapView: React.FC<MapViewProps> = ({ position, apiKey, mapId }) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    if (position && mapInstance) {
      const loadMarker = async () => {
        try {
          const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
          new AdvancedMarkerElement({
            map: mapInstance,
            position,
            title: 'You are here',
          });
        } catch (error) {
          console.error('Error loading AdvancedMarkerElement:', error);
        }
      };

      loadMarker();
    }
  }, [position, mapInstance]);

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
