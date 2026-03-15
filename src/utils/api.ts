import { Location } from '../types';

export async function searchAddress(query: string, lat?: number, lng?: number): Promise<Location[]> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', query);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '5');
    if (lat && lng) {
      url.searchParams.append('viewbox', `${lng-0.1},${lat+0.1},${lng+0.1},${lat-0.1}`);
      url.searchParams.append('bounded', '1');
    }

    const res = await fetch(url.toString());
    const data = await res.json();
    
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name
    }));
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.append('lat', lat.toString());
    url.searchParams.append('lon', lng.toString());
    url.searchParams.append('format', 'json');

    const res = await fetch(url.toString());
    const data = await res.json();
    return data.display_name || 'Избрана локация';
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return 'Избрана локация';
  }
}

export async function getRoute(start: Location, end: Location): Promise<{ coords: [number, number][], distance: number, duration: number } | null> {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates;
      return {
        coords: coords.map((c: [number, number]) => [c[1], c[0]]), // GeoJSON is [lng, lat], Leaflet is [lat, lng]
        distance: route.distance, // in meters
        duration: route.duration // in seconds
      };
    }
    return null;
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
}
