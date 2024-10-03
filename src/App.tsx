import React, { useEffect, useRef, useState } from 'react';
import { LoadScript, GoogleMap } from '@react-google-maps/api';

const libraries: ('places' | 'marker')[] = ['places', 'marker'];

const App: React.FC = () => {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  /* This is where we fetch the user geolocation */
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
    if (position && mapRef.current) {
      const loadMarker = async () => {
        try {
          // Import the AdvancedMarkerElement library
          const { AdvancedMarkerElement } = (await google.maps.importLibrary(
            'marker'
          )) as google.maps.MarkerLibrary;

          // Create the AdvancedMarkerElement
          new AdvancedMarkerElement({
            map: mapRef.current!,
            position: position,
            title: 'You are here',
          });
        } catch (error) {
          console.error('Error loading AdvancedMarkerElement:', error);
        }
      };

      loadMarker();
    }
  }, [position, mapRef]);

  /*This is where the map is actually rendered within the html*/
  return (
    <div>
      <h1>Closeish.app</h1>
      {position ? (
        <LoadScript 
          googleMapsApiKey="AIzaSyBoRUGEUtxPGxcrgLiRGGshyoILYZuMRSI" 
          libraries={libraries} 
          version="beta"
        >
          <p>Latitude: {position?.lat}</p>
          <p>Longitude: {position?.lng}</p>
          <GoogleMap
            mapContainerStyle={{ width: '100vw', height: '100vh' }}
            center={position}
            zoom={15}
            options={{
              mapId: 'ca79a2ddce39025d',
            }}
            onLoad={(map) => {
              mapRef.current = map;
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


// import React, { useState, useEffect } from 'react';
// import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

// const App: React.FC = () => {
//   const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

//   // Get user's geolocation
//   useEffect(() => {
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           setLocation({
//             lat: position.coords.latitude,
//             lng: position.coords.longitude,
//           });
//         },
//         (error) => {
//           console.error('Error getting location: ', error);
//         }
//       );
//     } else {
//       console.error('Geolocation not supported by this browser.');
//     }
//   }, []);

//   const containerStyle = {
//     width: '100vw',
//     height: '100vh',
//   };

//   return (
//     <div>
//       <h1>My Location</h1>
//       {location ? (
//         <div>
//           <p>Latitude: {location.lat}</p>
//           <p>Longitude: {location.lng}</p>
//           <LoadScript googleMapsApiKey="AIzaSyBoRUGEUtxPGxcrgLiRGGshyoILYZuMRSI">
//             <GoogleMap mapContainerStyle={containerStyle} center={location} zoom={15}>
//             </GoogleMap>
//           </LoadScript>
//         </div>
//       ) : (
//         <p>Loading location...</p>
//       )}
//     </div>
//   );
// };

// export default App;


// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <div>
//         <a href="https://vitejs.dev" target="_blank">
//           <img src={viteLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>Vite + React</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.tsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

// export default App