import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [22.7196, 75.8577]; // Indore

const validLat = (n) => Number.isFinite(n) && n >= -90 && n <= 90;
const validLng = (n) => Number.isFinite(n) && n >= -180 && n <= 180;
const round6 = (n) => parseFloat(Number(n).toFixed(6));

// Accepts "22.7196, 75.8577", or a full Google Maps link containing
// @lat,lng  /  ?q=lat,lng  /  !3dlat!4dlng
export function parseCoords(text) {
  const t = decodeURIComponent((text || '').trim());
  const num = '(-?\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`@${num},\\s*${num}`),
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`[?&](?:q|ll|query)=${num},\\s*${num}`),
    new RegExp(`^\\s*${num}\\s*[,;\\s]\\s*${num}\\s*$`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2]);
      if (validLat(lat) && validLng(lng)) return { lat: round6(lat), lng: round6(lng) };
    }
  }
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(round6(e.latlng.lat), round6(e.latlng.lng)) });
  return null;
}

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1]]);
  return null;
}

/**
 * Props: lat, lng (strings from the form), onChange(latStr, lngStr),
 *        onAddressFound(address) — optional, used by "Search place".
 */
export default function CoordinatePicker({ lat, lng, onChange, onAddressFound }) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [paste, setPaste] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const nLat = parseFloat(lat); const nLng = parseFloat(lng);
  const hasPoint = validLat(nLat) && validLng(nLng);
  const position = hasPoint ? [nLat, nLng] : null;

  const setPoint = (la, ln) => onChange(String(la), String(ln));

  const useMyLocation = () => {
    setMsg({ type: '', text: '' });
    if (!navigator.geolocation) {
      return setMsg({ type: 'error', text: 'This browser does not support location. Use one of the other options below.' });
    }
    if (!window.isSecureContext) {
      return setMsg({ type: 'error', text: 'Location only works on https:// or localhost. Use the map, search, or paste option instead.' });
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setPoint(round6(pos.coords.latitude), round6(pos.coords.longitude));
        const acc = Math.round(pos.coords.accuracy);
        setMsg(acc > 500
          ? { type: 'warn', text: `Location found but only accurate to ~${acc} m (typical for laptops/Wi-Fi). Drag-check it on the map by clicking the exact drain spot.` }
          : { type: 'ok', text: `Location found (accurate to ~${acc} m).` });
      },
      (err) => {
        setGpsLoading(false);
        const reasons = {
          1: 'Location permission was blocked. Click the 🔒 icon in the address bar → allow Location, then try again.',
          2: 'Your device could not determine its location. On Windows turn on Settings → Privacy → Location. Or use the map/search/paste option.',
          3: 'Timed out while finding location. Try again, or use the map/search/paste option.',
        };
        setMsg({ type: 'error', text: reasons[err.code] || 'Could not get location.' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const applyPaste = () => {
    const c = parseCoords(paste);
    if (!c) {
      return setMsg({ type: 'error', text: 'Could not read coordinates. Paste like "22.7196, 75.8577" or a full Google Maps link (short maps.app.goo.gl links are not supported — open them first and copy the long URL).' });
    }
    setPoint(c.lat, c.lng);
    setPaste('');
    setMsg({ type: 'ok', text: 'Coordinates set.' });
  };

  const searchPlace = async () => {
    if (!query.trim()) return;
    setSearching(true); setMsg({ type: '', text: '' });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query.trim())}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (!results.length) {
        setMsg({ type: 'error', text: 'No place found. Try a more specific name (e.g. "Rajwada, Indore").' });
      } else {
        setPoint(round6(results[0].lat), round6(results[0].lon));
        onAddressFound?.(results[0].display_name);
        setMsg({ type: 'ok', text: 'Place found — click the map to fine-tune the exact spot.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Place search failed (network). Use the map or paste option.' });
    } finally {
      setSearching(false);
    }
  };

  const tone = { ok: 'text-green-700', warn: 'text-amber-700', error: 'text-red-600' };

  return (
    <div className="col-span-2 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-[11px]">Latitude</label>
          <input type="number" step="any" className="input-field text-sm py-1.5" placeholder="22.7196"
            value={lat} onChange={(e) => onChange(e.target.value, lng)} />
        </div>
        <div>
          <label className="label text-[11px]">Longitude</label>
          <input type="number" step="any" className="input-field text-sm py-1.5" placeholder="75.8577"
            value={lng} onChange={(e) => onChange(lat, e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} disabled={gpsLoading} className="btn-secondary text-xs">
          {gpsLoading ? 'Locating…' : '📍 Use my location'}
        </button>
        <span className="text-[11px] text-slate-400">or search, paste, or click the map</span>
      </div>

      <div className="flex gap-2">
        <input className="input-field text-sm py-1.5 flex-1" placeholder="Search a place, e.g. Rajwada, Indore"
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } }} />
        <button type="button" onClick={searchPlace} disabled={searching} className="btn-secondary text-xs">
          {searching ? '…' : 'Search'}
        </button>
      </div>

      <div className="flex gap-2">
        <input className="input-field text-sm py-1.5 flex-1" placeholder='Paste "22.7196, 75.8577" or a Google Maps link'
          value={paste} onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPaste(); } }} />
        <button type="button" onClick={applyPaste} className="btn-secondary text-xs">Apply</button>
      </div>

      {msg.text && <p className={`text-xs ${tone[msg.type]}`}>{msg.text}</p>}

      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 220 }}>
        <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 16 : 12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={setPoint} />
          <Recenter position={position} />
          {position && (
            <Marker
              position={position}
              draggable
              eventHandlers={{
                dragend: (e) => { const p = e.target.getLatLng(); setPoint(round6(p.lat), round6(p.lng)); },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-[11px] text-slate-400">Click anywhere on the map to drop the pin, or drag the pin to adjust.</p>
    </div>
  );
}
