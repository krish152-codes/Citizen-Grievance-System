import React, { useState, useEffect } from 'react';

/**
 * LocationPicker — works WITHOUT leaflet dependency in report form.
 * Uses browser Geolocation API for GPS.
 * Shows OpenStreetMap iframe as a visual aid (no npm package needed).
 * Call onLocationChange({ address, lat, lng, district }) when done.
 */
export default function LocationPicker({ onLocationChange }) {
  const [address, setAddress]     = useState('');
  const [lat, setLat]             = useState(null);
  const [lng, setLng]             = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]   = useState('');
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [showMap, setShowMap]     = useState(false);

  const emit = (a, la, ln) => {
    onLocationChange?.({
      address: a || address,
      lat:     la ?? lat,
      lng:     ln ?? lng,
      district: '',
    });
  };

  const getGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = parseFloat(pos.coords.latitude.toFixed(6));
        const ln = parseFloat(pos.coords.longitude.toFixed(6));
        setLat(la);
        setLng(ln);
        setGpsLoading(false);
        setGpsSuccess(true);
        setShowMap(true);

        // Reverse geocode using OpenStreetMap Nominatim (free, no key needed)
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${ln}&accept-language=en`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const json = await res.json();
          const addr = json.display_name || `${la}, ${ln}`;
          setAddress(addr);
          emit(addr, la, ln);
        } catch {
          const addr = `${la}, ${ln}`;
          setAddress(addr);
          emit(addr, la, ln);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError('Location access denied. Allow location in browser settings or enter address manually.');
        else                setGpsError('Could not get location. Enter address manually.');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleAddressChange = (val) => {
    setAddress(val);
    emit(val, lat, lng);
  };

  const mapSrc = lat && lng
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
    : null;

  return (
    <div className="space-y-3">
      {/* Address text input */}
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder="e.g., MG Road near Gandhi Chowk, Indore"
          className="input-field pr-32"
        />
        {/* GPS button inside input */}
        <button
          type="button"
          onClick={getGPS}
          disabled={gpsLoading}
          className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            gpsSuccess
              ? 'bg-green-100 text-green-700'
              : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
          }`}
        >
          {gpsLoading ? (
            <>
              <div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" />
              Locating…
            </>
          ) : gpsSuccess ? (
            <>✓ GPS Found</>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Use GPS
            </>
          )}
        </button>
      </div>

      {/* GPS error */}
      {gpsError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ⚠️ {gpsError}
        </p>
      )}

      {/* GPS success + coordinates */}
      {gpsSuccess && lat && lng && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <span className="text-xs text-green-700 font-semibold">
            📍 GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="text-xs text-green-600 underline"
          >
            {showMap ? 'Hide map' : 'Show map'}
          </button>
        </div>
      )}

      {/* Embedded map preview */}
      {showMap && mapSrc && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 h-48">
          <iframe
            src={mapSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Issue Location"
          />
        </div>
      )}
    </div>
  );
}
