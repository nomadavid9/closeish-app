import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Coordinates } from '../types/geo';

type InlineTripMapProps = {
  origin: Coordinates;
  destination: Coordinates;
  mapId: string;
  isLoaded: boolean;
};

const InlineTripMap: React.FC<InlineTripMapProps> = ({ origin, destination, mapId, isLoaded }) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!mapInstance || !isLoaded) return;

    const loadPreview = async () => {
      try {
        const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

        markersRef.current.forEach((marker) => marker.map = null);
        markersRef.current = [];

        const originMarker = new AdvancedMarkerElement({
          map: mapInstance,
          position: origin,
          title: 'Origin',
        });
        markersRef.current.push(originMarker);

        const destinationPin = new PinElement({
          background: '#34A853',
          borderColor: '#188038',
          glyphColor: '#ffffff',
          glyph: '●',
          scale: 1.05,
        });
        const destinationMarker = new AdvancedMarkerElement({
          map: mapInstance,
          position: destination,
          title: 'Destination',
          content: destinationPin.element,
        });
        markersRef.current.push(destinationMarker);

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        mapInstance.fitBounds(bounds, 28);
      } catch (error) {
        console.error('Error loading inline trip map preview', error);
      }
    };

    loadPreview();
  }, [mapInstance, isLoaded, origin, destination]);

  if (!isLoaded) {
    return <p className="trip-fallback">Map preview unavailable.</p>;
  }

  return (
    <GoogleMap
      mapContainerClassName="place-card-map"
      center={origin}
      zoom={14}
      options={{
        mapId,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'cooperative',
      }}
      onLoad={setMapInstance}
    />
  );
};

export default InlineTripMap;
