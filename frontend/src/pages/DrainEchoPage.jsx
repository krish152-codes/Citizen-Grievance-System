import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/layout/AdminLayout';
import PublicNav from '../components/layout/PublicNav';
import StatusBadge from '../components/drain/StatusBadge';
import DrainEchoRecorder from '../components/drain/DrainEchoRecorder';
import ClassificationCard from '../components/drain/ClassificationCard';
import AudioWaveform from '../components/drain/AudioWaveform';
import { drainsAPI, drainEchoAPI, drainIncidentsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';

function Shell({ isMunicipal, children }) {
  // Municipal users get the admin chrome; citizens get the public nav.
  return isMunicipal ? <AdminLayout>{children}</AdminLayout> : (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      {children}
    </div>
  );
}

export default function DrainEchoPage() {
  const { isMunicipal, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedId = searchParams.get('drainId');

  const [phase, setPhase] = useState('select'); // select | record | analyzing | result | error
  const [drains, setDrains] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDrain, setSelectedDrain] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [incidentCreated, setIncidentCreated] = useState(null);

  useEffect(() => {
    drainsAPI.getAll().then(({ data }) => {
      setDrains(data.drains);
      if (preselectedId) {
        const found = data.drains.find((d) => d._id === preselectedId);
        if (found) setSelectedDrain(found);
      }
    });
  }, [preselectedId]);

  const filtered = useMemo(
    () => drains.filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.ward?.toLowerCase().includes(search.toLowerCase())),
    [drains, search]
  );

  const handleRecordingComplete = async ({ blob, durationSec, tapCount, clientReportedNoisy }) => {
    setRecordedBlob(blob);
    setPhase('analyzing');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('audio', blob, `echo-${Date.now()}.webm`);
    formData.append('drainId', selectedDrain._id);
    formData.append('durationSec', durationSec);
    formData.append('tapCount', tapCount);
    formData.append('clientReportedNoisy', clientReportedNoisy);

    // Best-effort location — never blocks the flow.
    try {
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { formData.append('lat', pos.coords.latitude); formData.append('lng', pos.coords.longitude); resolve(); },
            () => resolve(),
            { timeout: 2000 }
          );
        });
      }
    } catch { /* ignore */ }

    try {
      const { data } = await drainEchoAPI.analyze(formData);
      setDiagnostic(data.diagnostic);
      setPhase('result');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to analyze recording. Please try again.');
      setPhase('error');
    }
  };

  const createIncident = async () => {
    setCreatingIncident(true);
    try {
      const { data } = await drainIncidentsAPI.create({ drainId: selectedDrain._id, source: 'DRAIN_ECHO', diagnosticId: diagnostic._id });
      setIncidentCreated(data.incident);
    } catch {
      setErrorMsg('Failed to create incident. You can try again from the drain page.');
    } finally {
      setCreatingIncident(false);
    }
  };

  const reset = () => {
    setPhase('select'); setSelectedDrain(null); setDiagnostic(null); setRecordedBlob(null); setIncidentCreated(null); setErrorMsg('');
  };

  return (
    <Shell isMunicipal={isMunicipal}>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Drain Echo</h1>
          <p className="text-slate-500 text-sm">Acoustic diagnostic for suspected drain blockage — a diagnostic aid, not a confirmed inspection.</p>
        </div>

        {/* ── Step 1: Select a drain ── */}
        {phase === 'select' && (
          <div className="card p-5">
            {!selectedDrain ? (
              <>
                <label className="label text-xs">Select a Drain</label>
                <input
                  className="input-field text-sm mb-3"
                  placeholder="Search by name or ward…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-slate-50 border border-slate-100 rounded-xl">
                  {filtered.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">No drains found.</p>
                  ) : filtered.map((d) => (
                    <button
                      key={d._id}
                      onClick={() => setSelectedDrain(d)}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                        <p className="text-xs text-slate-400">{d.deviceId} · {d.ward}</p>
                      </div>
                      <StatusBadge kind="water" status={d.latest?.waterStatus} size="sm" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Selected Drain</p>
                    <p className="font-display text-lg font-bold text-slate-900">{selectedDrain.name}</p>
                    <p className="text-xs text-slate-400">{selectedDrain.deviceId} · {selectedDrain.ward}</p>
                  </div>
                  <button onClick={() => setSelectedDrain(null)} className="text-xs text-brand-600 font-bold hover:underline">Change</button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Water Level</p>
                    <StatusBadge kind="water" status={selectedDrain.latest?.waterStatus} size="sm" />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Atmosphere</p>
                    <StatusBadge kind="atmosphere" status={selectedDrain.latest?.atmosphereStatus} size="sm" />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Update</p>
                    <p className="text-xs font-semibold text-slate-700">{selectedDrain.latest?.timestamp ? timeAgo(selectedDrain.latest.timestamp) : 'never'}</p>
                  </div>
                </div>

                <button onClick={() => setPhase('record')} className="btn-primary w-full">Begin Diagnostic</button>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Record ── */}
        {phase === 'record' && (
          <DrainEchoRecorder onComplete={handleRecordingComplete} onCancel={() => setPhase('select')} />
        )}

        {/* ── Step 3: Analyzing ── */}
        {phase === 'analyzing' && (
          <div className="card p-10 text-center">
            <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin mx-auto mb-4" />
            <p className="font-display font-bold text-slate-900 mb-1">Analyzing Drain Echo…</p>
            <p className="text-xs text-slate-400">{selectedDrain?.name} · {new Date().toLocaleTimeString('en-IN')}</p>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="card p-6 text-center">
            <span className="text-3xl block mb-2">⚠️</span>
            <p className="font-semibold text-slate-800 mb-1">Could not complete analysis</p>
            <p className="text-sm text-slate-500 mb-5">{errorMsg}</p>
            <div className="flex items-center gap-3">
              <button onClick={reset} className="btn-secondary flex-1">Start Over</button>
              <button onClick={() => setPhase('record')} className="btn-primary flex-1">Retry Recording</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {phase === 'result' && diagnostic && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{selectedDrain.name}</span>
              <span>·</span>
              <span>{selectedDrain.ward}</span>
            </div>

            <ClassificationCard diagnostic={diagnostic} />

            {recordedBlob && <AudioWaveform mode="playback" audioBlob={recordedBlob} />}

            {incidentCreated ? (
              <div className="card p-5 text-center bg-green-50 border-green-200">
                <p className="font-semibold text-green-800 mb-1">✓ Incident {incidentCreated.incidentId} created</p>
                <p className="text-xs text-green-600 mb-4">Municipal staff have been notified.</p>
                <button onClick={() => navigate(isMunicipal ? `/incidents/${incidentCreated._id}` : '/citizen-dashboard')} className="btn-primary w-full">
                  {isMunicipal ? 'View Incident' : 'Back to Dashboard'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => setPhase('record')} className="btn-secondary flex-1">Retry Recording</button>
                <button onClick={createIncident} disabled={creatingIncident} className="btn-primary flex-1">
                  {creatingIncident ? 'Creating…' : 'Create Incident'}
                </button>
              </div>
            )}
            {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}

            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 w-full text-center">Run another diagnostic</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
