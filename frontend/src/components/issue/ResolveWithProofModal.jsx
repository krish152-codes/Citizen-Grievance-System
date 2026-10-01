import React, { useState, useRef, useEffect } from 'react';
import { issuesAPI, SERVER_URL } from '../../services/api';
import { VerdictBadge } from './ResolutionProofCard';

const MAX_PHOTOS = 3;

// Shrink phone photos (often 5–10 MB) to ~1600px JPEG before upload
async function compressImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // HEIC etc. — let the server decide
  }
}

const getPosition = () => new Promise((resolve) => {
  if (!navigator.geolocation || !window.isSecureContext) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
});

export default function ResolveWithProofModal({ issue, status = 'resolved', onClose, onDone }) {
  const [photos, setPhotos]       = useState([]); // [{ file, preview }]
  const [notes, setNotes]         = useState('');
  const [attachLoc, setAttachLoc] = useState(true);
  const [phase, setPhase]         = useState('form'); // form | checking | rejected | done
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const inputRef = useRef(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line

  const addFiles = async (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length);
    const prepared = await Promise.all(picked.map(async (f) => {
      const file = await compressImage(f);
      return { file, preview: URL.createObjectURL(file) };
    }));
    setPhotos((prev) => [...prev, ...prepared].slice(0, MAX_PHOTOS));
    setError('');
  };

  const removePhoto = (i) => {
    URL.revokeObjectURL(photos[i].preview);
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (withOverride = false) => {
    if (!photos.length) return setError('Please add at least one photo of the completed work.');
    if (withOverride && overrideReason.trim().length < 10) return setError('Please explain the override in at least 10 characters.');

    setPhase('checking'); setError('');
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append('proof', p.file));
      fd.append('status', status);
      fd.append('notes', notes);
      if (withOverride) fd.append('overrideReason', overrideReason.trim());
      if (attachLoc) {
        const pos = await getPosition();
        if (pos) { fd.append('lat', pos.lat); fd.append('lng', pos.lng); fd.append('accuracy', Math.round(pos.accuracy)); }
      }
      const { data } = await issuesAPI.resolveWithProof(issue._id, fd);
      setResult(data); setPhase('done');
    } catch (err) {
      const d = err.response?.data;
      if (err.response?.status === 422 && d?.code === 'VERIFICATION_FAILED') {
        setResult(d); setPhase('rejected');
      } else {
        setError(d?.message || (err.code === 'ECONNABORTED' ? 'The check took too long. Please try again.' : 'Upload failed. Please try again.'));
        setPhase('form');
      }
    }
  };

  const retake = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]); setResult(null); setOverrideMode(false); setOverrideReason(''); setError(''); setPhase('form');
  };

  const title = status === 'closed' ? 'Close Complaint' : 'Mark as Resolved';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="font-display font-bold text-xl text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400">#{issue.ticketId} · photo proof of completed work required</p>
          </div>
          {phase !== 'checking' && (
            <button onClick={phase === 'done' ? () => { onDone?.(); onClose(); } : onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl">×</button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* ── DONE ── */}
          {phase === 'done' && (
            <>
              <div className="text-center py-2">
                <div className="text-4xl mb-2">{result.verification?.verdict === 'RESOLVED' ? '✅' : '🕓'}</div>
                <p className="font-bold text-slate-900">Complaint {status === 'closed' ? 'closed' : 'marked resolved'}</p>
                <div className="mt-2"><VerdictBadge verification={result.issue?.resolution?.verification} /></div>
              </div>
              {result.verification?.reason && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{result.verification.reason}</p>}
              {result.locationCheck === 'FAR' && <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">⚠️ The photo location is far from the complaint site and has been flagged in the record.</p>}
              <button className="btn-primary w-full" onClick={() => { onDone?.(); onClose(); }}>Done</button>
            </>
          )}

          {/* ── CHECKING ── */}
          {phase === 'checking' && (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <p className="font-semibold text-slate-800">Checking your photo…</p>
              <p className="text-xs text-slate-400 mt-1">Comparing the site before and after the work. This takes a few seconds.</p>
            </div>
          )}

          {/* ── REJECTED ── */}
          {phase === 'rejected' && (
            <>
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="font-bold text-red-700 mb-1">{result.message}</p>
                {result.verification?.reason && <p className="text-sm text-red-700/90">{result.verification.reason}</p>}
                {result.locationCheck === 'FAR' && <p className="text-xs text-amber-700 mt-2">⚠️ Photo was also taken ~{result.distanceFromComplaintM} m from the complaint site.</p>}
              </div>

              {!overrideMode ? (
                <div className="space-y-2">
                  <button className="btn-primary w-full" onClick={retake}>📷 Upload a different photo</button>
                  <button className="w-full text-sm text-slate-500 hover:text-slate-700 underline py-1" onClick={() => setOverrideMode(true)}>
                    The work is done — close anyway with a reason
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="label">Reason for closing despite the check</p>
                  <textarea rows={3} className="input-field resize-none" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Repair is done; photo was taken from the wrong angle." />
                  <p className="text-[11px] text-slate-400">This is recorded permanently in the complaint's audit trail.</p>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1" onClick={() => { setOverrideMode(false); setError(''); }}>Back</button>
                    <button className="btn-primary flex-1" onClick={() => submit(true)}>Close with override</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── FORM ── */}
          {phase === 'form' && (
            <>
              {issue.imageUrls?.length > 0 && (
                <div>
                  <p className="label mb-2">Original complaint photo{issue.imageUrls.length > 1 ? 's' : ''}</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {issue.imageUrls.slice(0, 3).map((u, i) => (
                      <img key={i} src={`${SERVER_URL}${u}`} alt="Before" className="w-24 h-20 object-cover rounded-xl border border-slate-200 flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="label mb-2">Photo of the completed work <span className="text-red-500">*</span></p>
                <div className="flex gap-2 flex-wrap">
                  {photos.map((p, i) => (
                    <div key={p.preview} className="relative">
                      <img src={p.preview} alt={`Proof ${i + 1}`} className="w-24 h-20 object-cover rounded-xl border border-slate-200" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-800 text-white text-xs leading-none">×</button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button type="button" onClick={() => inputRef.current?.click()}
                      className="w-24 h-20 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600 flex flex-col items-center justify-center text-xs font-semibold">
                      <span className="text-xl">📷</span>Add photo
                    </button>
                  )}
                </div>
                <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <p className="text-[11px] text-slate-400 mt-2">Stand at the same spot as the original photo. Up to {MAX_PHOTOS} photos.</p>
              </div>

              <div>
                <p className="label">Work done (optional)</p>
                <textarea rows={2} className="input-field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Pothole filled with asphalt and compacted." />
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600 p-3 bg-slate-50 rounded-xl">
                <input type="checkbox" className="mt-0.5" checked={attachLoc} onChange={(e) => setAttachLoc(e.target.checked)} />
                <span>Attach my current location to confirm I'm at the complaint site <span className="text-slate-400">(recommended)</span></span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => submit(false)}>Verify &amp; {status === 'closed' ? 'Close' : 'Resolve'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
