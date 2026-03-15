import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import { Location } from '../types';

// Fix Leaflet default icon issue
const icon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons
export const carIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204121.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

export const userIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149059.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

function MapUpdater({ userLocation, destination, isSelectingOnMap }: { userLocation: Location | null, destination: Location | null, isSelectingOnMap?: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (userLocation && destination) {
      const bounds = L.latLngBounds(
        [userLocation.lat, userLocation.lng],
        [destination.lat, destination.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (userLocation && isSelectingOnMap) {
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
    }
  }, [destination, isSelectingOnMap]); // Re-run when destination or selection mode changes

  return null;
}

function MapEvents({ onMapClick, onMapMove }: { onMapClick?: (lat: number, lng: number) => void, onMapMove?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
    move() {
      if (onMapMove) {
        const center = map.getCenter();
        onMapMove(center.lat, center.lng);
      }
    },
    moveend() {
      if (onMapMove) {
        const center = map.getCenter();
        onMapMove(center.lat, center.lng);
      }
    }
  });
  return null;
}

interface MapProps {
  userLocation: Location | null;
  destination: Location | null;
  driverLocation: Location | null;
  route: [number, number][] | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMapMove?: (lat: number, lng: number) => void;
  isSelectingOnMap?: boolean;
  appMode?: 'passenger' | 'driver';
}

export default function Map({ userLocation, destination, driverLocation, route, onMapClick, onMapMove, isSelectingOnMap, appMode = 'passenger' }: MapProps) {
  const defaultCenter: [number, number] = [42.6977, 23.3219]; // Sofia, Bulgaria

  return (
    <div className="relative w-full h-full">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        className="w-full h-full" 
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater userLocation={userLocation} destination={destination} isSelectingOnMap={isSelectingOnMap} />
        <MapEvents onMapClick={onMapClick} onMapMove={onMapMove} />
        
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={appMode === 'driver' ? carIcon : userIcon}>
            <Popup>{appMode === 'driver' ? 'Вие (Шофьор)' : 'Вие сте тук'}</Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]}>
            <Popup>{destination.address || 'Дестинация'}</Popup>
          </Marker>
        )}

        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon}>
            <Popup>Вашето такси</Popup>
          </Marker>
        )}

        {route && <Polyline positions={route} color="#3b82f6" weight={5} opacity={0.8} />}
      </MapContainer>

      {isSelectingOnMap && (
        <div className="absolute inset-0 pointer-events-none z-[1000] flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            {/* The Pin - positioned above the center */}
            <div className="absolute bottom-0 mb-1 flex flex-col items-center animate-bounce">
              {/* Pin Head */}
              <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
              {/* Pin Stem */}
              <div className="w-1 h-4 bg-blue-500 shadow-lg" />
            </div>
            
            {/* Target Dot - exactly at the center */}
            <div className="w-2 h-2 bg-blue-500 rounded-full border-2 border-white shadow-xl" />
            {/* Shadow Circle */}
            <div className="w-6 h-2 bg-black/20 rounded-full blur-[2px] mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}
