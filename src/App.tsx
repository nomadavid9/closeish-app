import React, { useEffect, useState } from 'react';
import { LoadScript, GoogleMap } from '@react-google-maps/api';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;
const libraries: ('places' | 'marker')[] = ['places', 'marker'];

const App: React.FC = () => {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  /* This is where we fetch the user's geolocation */
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  }, []);

  // Load the AdvancedMarkerElement when the map and position are ready
  useEffect(() => {
    if (position && mapInstance) {
      const loadMarker = async () => {
        try {
          // Import the AdvancedMarkerElement library
          const { AdvancedMarkerElement } = (await google.maps.importLibrary(
            'marker'
          )) as google.maps.MarkerLibrary;

          // Create the AdvancedMarkerElement
          new AdvancedMarkerElement({
            map: mapInstance,
            position: position,
            title: 'You are here',
          });
        } catch (error) {
          console.error('Error loading AdvancedMarkerElement:', error);
        }
      };

      loadMarker();
    }
  }, [position, mapInstance]);

  /* This is where the map is actually rendered within the HTML */
  return (
    <div>
      <h1>Closeish.app</h1>
      {position ? (
        <LoadScript
          googleMapsApiKey={API_KEY}
          libraries={libraries}
          version="beta"
        >
          <p>Latitude: {position.lat}</p>
          <p>Longitude: {position.lng}</p>
          <GoogleMap
            mapContainerStyle={{ width: '100vw', height: '100vh' }}
            center={position}
            zoom={15}
            options={{
              mapId: MAP_ID,
            }}
            onLoad={(map) => {
              setMapInstance(map);
            }}
          >
            {/* The AdvancedMarkerElement will be added via useEffect */}
          </GoogleMap>
        </LoadScript>
      ) : (
        <p>Loading map...</p>
      )}
    </div>
  );
};

export default App;