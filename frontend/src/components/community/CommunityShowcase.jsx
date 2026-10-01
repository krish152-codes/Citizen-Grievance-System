import React, { useState, useEffect, useCallback, useRef } from 'react';
import { communityAPI, SERVER_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const ACTIVITY_TYPES = [
  { id: 'pothole_fixing',     label: 'Pothole fixing',     icon: '🕳️' },
  { id: 'drain_cleaning',     label: 'Drain cleaning',     icon: '🌊' },
  { id: 'garbage_cleanup',    label: 'Garbage cleanup',    icon: '🧹' },
  { id: 'tree_planting',      label: 'Tree planting',      icon: '🌳' },
  { id: 'water_leak_repair',  label: 'Water leak repair',  icon: '🚰' },
  { id: 'streetlight_repair', label: 'Streetlight repair', icon: '💡' },
  { id: 'other',              label: 'Other',              icon: '🤝' },
];
const typeInfo = (id) => ACTIVITY_TYPES.find((t) => t.id === id) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];

const MAX_CAPTION = 280;

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
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // e.g. HEIC — let the server decide
  }
}

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Post modal ───────────────────────────────────────────
function NewPostModal({ onClose, onCreated }) {
  const [activityType, setActivityType] = useState('pothole_fixing');
  const [photos, setPhotos]   = useState([null, null]);   // File objects
  const [previews, setPreviews] = useState(['', '']);
  const [caption, setCaption] = useState('');
  const [address, setAddress] = useState('');
  const [gps, setGps]         = useState(null);           // { lat, lng, accuracy }
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErr, setGpsErr]   = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const inputs = [useRef(), useRef()];

  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), []); // eslint-disable-line

  const pick = async (idx, file) => {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type)) { setError('Please choose a JPG, PNG or WebP photo.'); return; }
    setError('');
    const small = await compressImage(file);
    setPhotos((p) => p.map((x, i) => (i === idx ? small : x)));
    setPreviews((p) => { if (p[idx]) URL.revokeObjectURL(p[idx]); return p.map((x, i) => (i === idx ? URL.createObjectURL(small) : x)); });
  };

  const clearPhoto = (idx) => {
    setPhotos((p) => p.map((x, i) => (i === idx ? null : x)));
    setPreviews((p) => { if (p[idx]) URL.revokeObjectURL(p[idx]); return p.map((x, i) => (i === idx ? '' : x)); });
  };

  const detectGps = () => {
    setGpsErr('');
    if (!navigator.geolocation || !window.isSecureContext) { setGpsErr('GPS is not available in this browser / connection.'); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setGpsBusy(false); },
      (e) => {
        setGpsBusy(false);
        setGpsErr(e.code === 1 ? 'Location permission denied — allow it in your browser, or just type the place.' : 'Could not get GPS. Try again or type the place.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!photos[0] || !photos[1]) return setError('Please add both photos.');
    if (caption.trim().length < 3) return setError('Please add a short caption.');
    if (!address.trim()) return setError('Please type the location (area / landmark).');

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('activityType', activityType);
      fd.append('caption', caption.trim());
      fd.append('location', JSON.stringify({ address: address.trim(), ...(gps || {}) }));
      photos.forEach((f) => fd.append('images', f));
      const { data } = await communityAPI.create(fd);
      onCreated(data.post);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not post. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const labels = ['Photo 1 (e.g. Before)', 'Photo 2 (e.g. After)'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-slate-900">🌟 Share your good work</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        {/* Activity */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">What did you do?</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => setActivityType(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${activityType === t.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two photos */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">2 photos <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i}>
                <input ref={inputs[i]} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { pick(i, e.target.files?.[0]); e.target.value = ''; }} />
                {previews[i] ? (
                  <div className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200">
                    <img src={previews[i]} alt={labels[i]} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => clearPhoto(i)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white text-sm">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => inputs[i].current?.click()}
                    className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50 flex flex-col items-center justify-center gap-1 text-slate-500 transition-colors">
                    <span className="text-2xl">📷</span>
                    <span className="text-[11px] font-semibold px-2 text-center">{labels[i]}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div>
          <label className="text-xs font-semibold text-slate-600">Short caption <span className="text-red-500">*</span></label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))} rows={2}
            placeholder="e.g. Filled the pothole outside the school with 4 neighbours this Sunday"
            className="mt-1 w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          <p className="text-[11px] text-slate-400 text-right">{caption.length}/{MAX_CAPTION}</p>
        </div>

        {/* Location: manual + GPS */}
        <div>
          <label className="text-xs font-semibold text-slate-600">Location <span className="text-red-500">*</span></label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300}
            placeholder="Area / landmark, e.g. Near Vijay Nagar Square, Indore"
            className="mt-1 w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button type="button" onClick={detectGps} disabled={gpsBusy}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {gpsBusy ? 'Getting GPS…' : gps ? '📍 Refresh GPS' : '📍 Add my GPS location'}
            </button>
            {gps && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                ✓ {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}{gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''}
              </span>
            )}
          </div>
          {gpsErr && <p className="text-xs text-amber-700 mt-1">{gpsErr}</p>}
          <p className="text-[11px] text-slate-400 mt-1">Tip: tap GPS while standing at the spot — posts with GPS get a “GPS verified” badge.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">⚠️ {error}</div>}

        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-sm disabled:opacity-60">
          {busy ? 'Posting…' : 'Post to community'}
        </button>
      </form>
    </div>
  );
}

// ── Single post card ─────────────────────────────────────
function PostCard({ post, onAppreciate, onDelete, canInteract }) {
  const t = typeInfo(post.activityType);
  const { lat, lng } = post.location || {};
  const mapUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location?.address || '')}`;

  return (
    <article className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div className="grid grid-cols-2 gap-0.5 bg-slate-100">
        {post.images.map((u, i) => (
          <a key={i} href={`${SERVER_URL}${u}`} target="_blank" rel="noreferrer" className="relative block aspect-square">
            <img src={`${SERVER_URL}${u}`} alt={`${t.label} photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/55 text-white rounded px-1.5 py-0.5">{i === 0 ? 'Photo 1' : 'Photo 2'}</span>
          </a>
        ))}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold bg-brand-50 text-brand-700 rounded-full px-2.5 py-1">{t.icon} {t.label}</span>
          <span className="text-[11px] text-slate-400">{timeAgo(post.createdAt)}</span>
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-line break-words">{post.caption}</p>
        <a href={mapUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-brand-600 flex items-start gap-1">
          <span>📍</span>
          <span className="break-words">{post.location?.address}{post.gpsVerified && <span className="ml-1.5 text-green-700 font-semibold">✓ GPS verified</span>}</span>
        </a>

        <div className="mt-auto pt-2 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-500">by <b className="text-slate-700">{post.isMine ? 'You' : post.userName}</b></span>
          <div className="flex items-center gap-2">
            {post.canDelete && (
              <button onClick={() => onDelete(post)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
            )}
            <button onClick={() => onAppreciate(post)} disabled={!canInteract || post.isMine}
              title={post.isMine ? "You can't appreciate your own post" : 'Appreciate this work'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${post.hasAppreciated ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}>
              👏 {post.appreciationCount}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Section: feed + "share" button ───────────────────────
export default function CommunityShowcase() {
  const { user } = useAuth();
  const [posts, setPosts]     = useState([]);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [type, setType]       = useState('');
  const [sort, setSort]       = useState('new');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [open, setOpen]       = useState(false);
  const [toast, setToast]     = useState('');

  const load = useCallback(async (pg = 1, replace = true) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await communityAPI.getPosts({ page: pg, limit: 6, sort, ...(type && { type }) });
      setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
      setPage(data.pagination.page);
      setPages(data.pagination.pages);
    } catch {
      setError('Could not load community posts.');
    } finally {
      setLoading(false);
    }
  }, [type, sort]);

  useEffect(() => { load(1, true); }, [load]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const appreciate = async (post) => {
    // optimistic update
    const apply = (p, has, count) => ({ ...p, hasAppreciated: has, appreciationCount: count });
    setPosts((ps) => ps.map((p) => (p._id === post._id ? apply(p, !p.hasAppreciated, p.appreciationCount + (p.hasAppreciated ? -1 : 1)) : p)));
    try {
      const { data } = await communityAPI.appreciate(post._id);
      setPosts((ps) => ps.map((p) => (p._id === post._id ? apply(p, data.hasAppreciated, data.appreciationCount) : p)));
    } catch {
      setPosts((ps) => ps.map((p) => (p._id === post._id ? post : p)));
    }
  };

  const remove = async (post) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await communityAPI.delete(post._id);
      setPosts((ps) => ps.filter((p) => p._id !== post._id));
    } catch (err) {
      flash(err.response?.data?.message || 'Could not delete the post.');
    }
  };

  const created = (post) => {
    setOpen(false);
    setPosts((ps) => [post, ...ps]);
    flash('🎉 Thank you! Your work is now on the community wall.');
  };

  return (
    <section>
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-800 flex items-center gap-2">🌟 Community Heroes</h2>
          <p className="text-sm text-slate-500">Fixed a pothole, cleaned a drain or tidied your street? Share it and inspire others.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">📸 Share your work</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button onClick={() => setType('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${!type ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>All</button>
        {ACTIVITY_TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(type === t.id ? '' : t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${type === t.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="ml-auto text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600">
          <option value="new">Newest</option>
          <option value="top">Most appreciated</option>
        </select>
      </div>

      {toast && <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl p-3">{toast}</div>}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>}

      {loading && posts.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-72 bg-slate-200 rounded-2xl" />)}
        </div>
      ) : posts.length === 0 && !error ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 px-4">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-slate-600 text-sm">No posts yet{type ? ' for this activity' : ''}. Be the first to inspire your neighbours!</p>
          <button onClick={() => setOpen(true)} className="btn-primary mt-4 text-sm px-5 py-2">Share your work</button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p) => <PostCard key={p._id} post={p} canInteract={!!user} onAppreciate={appreciate} onDelete={remove} />)}
          </div>
          {page < pages && (
            <div className="text-center mt-5">
              <button onClick={() => load(page + 1, false)} disabled={loading}
                className="btn-secondary text-sm px-5 py-2 disabled:opacity-60">{loading ? 'Loading…' : 'Load more'}</button>
            </div>
          )}
        </>
      )}

      {open && <NewPostModal onClose={() => setOpen(false)} onCreated={created} />}
    </section>
  );
}
