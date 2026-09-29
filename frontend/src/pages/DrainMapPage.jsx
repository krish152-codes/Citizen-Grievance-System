import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import AdminLayout from '../components/layout/AdminLayout';
import { drainsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLORS = { NORMAL: '#22c55e', WARNING: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444', OFFLINE: '#94a3b8' };

const createDrainIcon = (status) => {
  const color = STATUS_COLORS[status] || STATUS_COLORS.NORMAL;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 23 13 23s13-13.25 13-23C26 5.82 20.18 0 13 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="13" y="18" font-size="13" text-anchor="middle" fill="white">💧</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 36], iconAnchor: [13, 36], popupAnchor: [0, -36] });
};

const DEFAULT_CENTER = [22.7196, 75.8577]; // Indore, India

export default function DrainMapPage() {
  const navigate = useNavigate();
  const [drains, setDrains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    drainsAPI.getAll().then(({ data }) => setDrains(data.drains)).finally(() => setLoading(false));
  }, []);

  const mapped = drains.filter((d) => d.location?.lat && d.location?.lng);

  return (
    <AdminLayout>
      <div className="h-full relative">
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-2xl shadow-lg px-4 py-3 border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Monitored Drains</p>
          <p className="font-display text-2xl font-bold text-slate-900">{loading ? '—' : mapped.length}</p>
        </div>

        <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapped.map((d) => (
            <Marker
              key={d._id}
              position={[d.location.lat, d.location.lng]}
              icon={createDrainIcon(d.latest?.deviceStatus === 'OFFLINE' ? 'OFFLINE' : d.latest?.waterStatus)}
            >
              <Popup maxWidth={260}>
                <div style={{ padding: 2, fontFamily: 'inherit' }}>
                  <p style={{ fontWeight: 800, fontSize: 13, margin: 0 }}>{d.name}</p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 8px' }}>{d.deviceId} · {d.ward}</p>
                  <p style={{ fontSize: 12, margin: '2px 0' }}>Water: <strong>{d.latest?.waterStatus}</strong> ({d.latest?.waterDepthCm ?? '—'} cm)</p>
                  <p style={{ fontSize: 12, margin: '2px 0' }}>Atmosphere: <strong>{d.latest?.atmosphereStatus}</strong></p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 8px' }}>Updated {d.latest?.timestamp ? timeAgo(d.latest.timestamp) : 'never'}</p>
                  <button
                    onClick={() => navigate(`/drains/${d._id}`)}
                    style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View Details →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-full shadow-lg border border-slate-100 px-4 py-2 flex items-center gap-4">
          {Object.entries(STATUS_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </span>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
