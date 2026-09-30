import React, { useState } from 'react';
import { drainsAPI } from '../../services/api';
import CoordinatePicker from './CoordinatePicker';

const EMPTY = {
  deviceId: '', name: '', ward: '', zone: '',
  address: '', lat: '', lng: '', depthCm: '', o2Installed: false,
};

export default function AddDrainModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.deviceId.trim() || !form.name.trim()) {
      setError('Device ID and Drain Name are required.');
      return;
    }
    const lat = form.lat === '' ? undefined : parseFloat(form.lat);
    const lng = form.lng === '' ? undefined : parseFloat(form.lng);
    if ((form.lat === '') !== (form.lng === '')) {
      setError('Enter both latitude and longitude, or leave both empty.');
      return;
    }
    if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180)) {
      setError('Latitude must be between -90 and 90, and longitude between -180 and 180.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await drainsAPI.create({
        deviceId: form.deviceId.trim(),
        name: form.name.trim(),
        ward: form.ward.trim(),
        zone: form.zone.trim(),
        location: { address: form.address.trim(), lat, lng },
        dimensions: { depthCm: form.depthCm === '' ? undefined : parseFloat(form.depthCm) },
        o2Installed: form.o2Installed,
      });
      onCreated(data.drain);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create drain.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Add New Drain</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-[11px]">Device ID *</label>
            <input className="input-field text-sm py-1.5" placeholder="DR-007" value={form.deviceId} onChange={set('deviceId')} />
          </div>
          <div>
            <label className="label text-[11px]">Drain Name *</label>
            <input className="input-field text-sm py-1.5" placeholder="Palasia Storm Drain" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label text-[11px]">Ward</label>
            <input className="input-field text-sm py-1.5" placeholder="Ward 4" value={form.ward} onChange={set('ward')} />
          </div>
          <div>
            <label className="label text-[11px]">Zone</label>
            <input className="input-field text-sm py-1.5" placeholder="Zone 2" value={form.zone} onChange={set('zone')} />
          </div>
          <div className="col-span-2">
            <label className="label text-[11px]">Address / Landmark</label>
            <input className="input-field text-sm py-1.5" value={form.address} onChange={set('address')} />
          </div>
          <CoordinatePicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
            onAddressFound={(addr) => setForm((f) => (f.address ? f : { ...f, address: addr }))}
          />
          <div>
            <label className="label text-[11px]">Full Drain Depth (cm)</label>
            <input type="number" step="any" className="input-field text-sm py-1.5" placeholder="150" value={form.depthCm} onChange={set('depthCm')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 mt-5">
            <input type="checkbox" checked={form.o2Installed} onChange={set('o2Installed')} />
            O₂ sensor installed
          </label>
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          The Device ID must match what your Arduino prints as <code>device_id</code>. Alert thresholds start at defaults — adjust them on the drain's page after creating it.
        </p>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Creating…' : 'Create Drain'}
          </button>
        </div>
      </form>
    </div>
  );
}
