import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI, analyticsAPI } from '../services/api';
import { getPriorityBadge, getStatusBadge, timeAgo, truncate } from '../utils/helpers';

// ── Fix Leaflet default marker icons (required for Vite) ──
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Custom colored markers by priority ───────────────────
const createPriorityIcon = (priority) => {
  const colors = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#3b82f6',
    low:      '#22c55e',
  };
  const color = colors[priority] || colors.medium;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
};

// ── Fly to location when selectedIssue changes ───────────
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

const FILTERS = ['All Issues', 'Infrastructure', 'Sanitation', 'Traffic', 'Water', 'Roads', 'Safety'];

const CATEGORY_MAP = {
  'Infrastructure': 'infrastructure',
  'Sanitation':     'waste',
  'Traffic':        'traffic',
  'Water':          'water',
  'Roads':          'roads',
  'Safety':         'public_safety',
};

export default function MapViewPage() {
  const navigate = useNavigate();

  const [issues, setIssues]           = useState([]);
  const [stats, setStats]             = useState(null);
  const [activeFilter, setActiveFilter] = useState('All Issues');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [mapCenter, setMapCenter]     = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Default center — Indore, India (change to your city)
  const DEFAULT_CENTER = [22.7196, 75.8577];

  // Get user's GPS location on load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {} // silent fail, use default
      );
    }
  }, []);

  // Fetch issues + stats
  useEffect(() => {
    const params = { limit: 100 };
    if (activeFilter !== 'All Issues') {
      params.category = CATEGORY_MAP[activeFilter];
    }

    setLoading(true);
    Promise.all([
      issuesAPI.getAll(params),
      analyticsAPI.getSummary(),
    ])
      .then(([issueRes, analyticsRes]) => {
        setIssues(issueRes.data.issues);
        setStats(analyticsRes.data.data?.overview);
      })
      .catch(() => setError('Failed to load data. Is the backend running?'))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  // Issues that have GPS coordinates
  const mappedIssues = issues.filter(
    (issue) => issue.location?.lat && issue.location?.lng
  );

  // Issues without GPS (show in list only)
  const unmappedIssues = issues.filter(
    (issue) => !issue.location?.lat || !issue.location?.lng
  );

  const handleIssueClick = (issue) => {
    setSelectedIssue(issue);
    if (issue.location?.lat && issue.location?.lng) {
      setMapCenter([issue.location.lat, issue.location.lng]);
    }
  };

  const mapStartCenter = userLocation || DEFAULT_CENTER;

  return (
    <AdminLayout>
      <div className="flex h-full overflow-hidden">

        {/* ── Map area ─────────────────────────────── */}
        <div className="flex-1 relative">

          {/* Stats overlay */}
          <div className="absolute top-4 left-4 z-[1000] space-y-2">
            <div className="bg-white rounded-2xl shadow-lg px-4 py-3 border border-slate-100 min-w-36">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active Issues</p>
              {loading
                ? <div className="h-7 bg-slate-200 rounded animate-pulse w-12 mt-1" />
                : <p className="font-display text-2xl font-bold text-slate-900">{stats?.activeIssues ?? '—'}</p>
              }
            </div>
            <div className="bg-white rounded-2xl shadow-lg px-4 py-3 border border-slate-100 min-w-36">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Resolution Rate</p>
              {loading
                ? <div className="h-7 bg-slate-200 rounded animate-pulse w-16 mt-1" />
                : <p className="font-display text-2xl font-bold text-slate-900">
                    {stats?.resolutionRate != null ? `${stats.resolutionRate}%` : '—'}
                  </p>
              }
            </div>
            {mappedIssues.length > 0 && (
              <div className="bg-brand-600 text-white rounded-2xl shadow-lg px-4 py-3 min-w-36">
                <p className="text-xs font-bold text-brand-200 uppercase tracking-wider mb-0.5">Pinned on Map</p>
                <p className="font-display text-2xl font-bold">{mappedIssues.length}</p>
              </div>
            )}
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={mapStartCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Fly to selected issue */}
            {mapCenter && <MapController center={mapCenter} />}

            {/* Issue markers */}
            {mappedIssues.map((issue) => (
              <Marker
                key={issue._id}
                position={[issue.location.lat, issue.location.lng]}
                icon={createPriorityIcon(issue.priority)}
                eventHandlers={{
                  click: () => handleIssueClick(issue),
                }}
              >
                <Popup maxWidth={280}>
                  <div className="p-1">
                    {/* Priority badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        issue.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        issue.priority === 'high'     ? 'bg-orange-100 text-orange-700' :
                        issue.priority === 'medium'   ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                      }`}>{issue.priority}</span>
                      <span className="text-xs text-gray-400">{timeAgo(issue.createdAt)}</span>
                    </div>

                    {/* Title */}
                    <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px', color: '#1e293b' }}>
                      {issue.title}
                    </p>

                    {/* Ticket ID */}
                    <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', margin: '0 0 6px' }}>
                      #{issue.ticketId}
                    </p>

                    {/* Description */}
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
                      {truncate(issue.description, 80)}
                    </p>

                    {/* Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: issue.status === 'resolved' ? '#dcfce7' : issue.status === 'in_progress' ? '#dbeafe' : '#f1f5f9',
                        color: issue.status === 'resolved' ? '#166534' : issue.status === 'in_progress' ? '#1d4ed8' : '#475569',
                      }}>
                        {issue.status?.replace(/_/g, ' ')}
                      </span>
                      <button
                        onClick={() => navigate(`/issues/${issue._id}`)}
                        style={{
                          fontSize: 11, fontWeight: 700, color: '#2563eb',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={L.divIcon({
                  html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.3)"></div>`,
                  className: '',
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              >
                <Popup>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>📍 Your Location</p>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-full shadow-lg border border-slate-100 px-4 py-2 flex items-center gap-4">
            {[
              ['#ef4444', 'Critical'],
              ['#f97316', 'High'],
              ['#3b82f6', 'Medium'],
              ['#22c55e', 'Low'],
            ].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>

          {/* No GPS data notice */}
          {!loading && issues.length > 0 && mappedIssues.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 p-6 text-center shadow-xl max-w-xs pointer-events-auto">
                <span className="text-3xl mb-2 block">📍</span>
                <h3 className="font-display font-bold text-slate-900 mb-1">No GPS Coordinates</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {issues.length} issue{issues.length !== 1 ? 's' : ''} found, but none have GPS coordinates yet.
                  When reporting, click the GPS button to add location.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────── */}
        <div className="w-80 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900">Recent Incidents</h3>
            {!loading && (
              <span className="text-xs text-slate-400 font-semibold">
                {issues.length} total · {mappedIssues.length} mapped
              </span>
            )}
          </div>

          {/* Category filters */}
          <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-slate-100 scrollbar-thin flex-shrink-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeFilter === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Issue list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))
            ) : error ? (
              <div className="p-6 text-center">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            ) : issues.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="text-3xl block mb-2">📭</span>
                <p className="text-sm font-medium">No issues found</p>
                <p className="text-xs mt-1">
                  {activeFilter !== 'All Issues'
                    ? 'Try a different filter'
                    : 'Submit the first report to see it here'}
                </p>
              </div>
            ) : (
              issues.map((issue) => {
                const pri = getPriorityBadge(issue.priority);
                const isSelected = selectedIssue?._id === issue._id;
                return (
                  <div
                    key={issue._id}
                    onClick={() => handleIssueClick(issue)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-50 border-l-2 border-brand-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`badge ${pri.color} text-[10px] font-bold uppercase`}>
                        {issue.priority}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {issue.location?.lat ? (
                          <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                            📍 GPS
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-semibold">no GPS</span>
                        )}
                        <span className="text-[10px] text-slate-400">{timeAgo(issue.createdAt)}</span>
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-slate-900 mb-1 leading-tight">{issue.title}</p>
                    <p className="text-xs text-slate-500 mb-2">{truncate(issue.description, 65)}</p>
                    <div className="flex items-center justify-between">
                      {issue.location?.address ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/>
                            <circle cx="12" cy="10" r="3" strokeWidth="2"/>
                          </svg>
                          <span className="truncate">{truncate(issue.location.address, 35)}</span>
                        </div>
                      ) : <span />}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/issues/${issue._id}`); }}
                        className="text-[10px] text-brand-600 font-bold hover:underline flex-shrink-0 ml-2"
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
            {unmappedIssues.length > 0 && (
              <p className="text-xs text-slate-400 text-center">
                {unmappedIssues.length} issue{unmappedIssues.length !== 1 ? 's' : ''} without GPS — not shown on map
              </p>
            )}
            <button
              onClick={() => navigate('/analytics')}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              View Analytics Report →
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}