import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

export default function App() {
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const categories = [
    { key: 'cafe',   label: 'Café' },
    { key: 'clinic', label: 'Clínica',   tag: 'amenity', value: 'clinic' },
    { key: 'fuel',   label: 'Gasolinera', tag: 'amenity', value: 'fuel' }
  ];
  const [active, setActive] = useState(categories[0].key);

  const buildQuery = (bounds, cat) => {
    const { tag = 'amenity', value = cat } = categories.find(c => c.key === cat);
    return `
      [out:json][timeout:25];
      (
        node["${tag}"="${value}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        way["${tag}"="${value}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        relation["${tag}"="${value}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
      );
      out center;
    `;
  };

  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = L.map('map', {
      center: [-2.170998, -79.922359],
      zoom: 13
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);
    fetchPlaces(active);
    mapRef.current.on('moveend', () => fetchPlaces(active));
  }, []);

  const searchLocation = async e => {
    e.preventDefault();
    if (!query) return;
    try {
      const { data } = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        { params: { q: query, format: 'json' } }
      );
      if (data.length) {
        const { lat, lon } = data[0];
        mapRef.current.setView([+lat, +lon], 13);
        fetchPlaces(active);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlaces = async cat => {
    setLoading(true);
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.Marker) mapRef.current.removeLayer(layer);
    });
    const bounds = mapRef.current.getBounds();
    const q = buildQuery(bounds, cat);
    try {
      const { data } = await axios.post(
        'https://overpass-api.de/api/interpreter',
        q,
        { headers: { 'Content-Type': 'text/plain' } }
      );
      data.elements.forEach(el => {
        const coords = el.lat && el.lon
          ? [el.lat, el.lon]
          : [el.center.lat, el.center.lon];
        const name = el.tags?.name || 'Sin nombre';
        const labels = {
          name:          'Nombre',
          amenity:       'Tipo',
          opening_hours: 'Horario',
          operator:      'Operador'
        };
        const popupContent = `
          <div class="p-2 rounded bg-white shadow-lg w-48">
            <h3 class="font-bold text-lg mb-1">${name}</h3>
            <ul class="text-sm space-y-1">
              ${Object.entries(el.tags || {}).map(([k, v]) => {
                const label = labels[k] 
                  || k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                return `<li><strong>${label}:</strong> ${v}</li>`;
              }).join('')}
            </ul>
          </div>`;
        L.marker(coords)
          .addTo(mapRef.current)
          .bindPopup(
            L.popup({ className: 'leaflet-popup-content-wrapper' })
              .setContent(popupContent)
          );
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-50 p-4 flex flex-col">
        <form onSubmit={searchLocation} className="mb-4">
          <input
            type="text"
            placeholder="Buscar ciudad o ubicación"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </form>
        <nav className="space-y-2 mb-4">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActive(cat.key); fetchPlaces(cat.key); }}
              className={
                `block w-full text-left p-2 rounded ` +
                (active === cat.key
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-200')
              }
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <span className="text-gray-700">Cargando...</span>
          </div>
        )}
        <div id="map" className="w-full h-full" />
      </div>
    </div>
  );
}
