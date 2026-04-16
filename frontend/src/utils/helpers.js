// ─── Date & Time ──────────────────────────────────────
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
};

// ─── Priority ──────────────────────────────────────────
export const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  low:      { label: 'Low',      color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

export const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  on_hold:     { label: 'On Hold',     color: 'bg-yellow-100 text-yellow-700' },
  escalated:   { label: 'Escalated',   color: 'bg-red-100 text-red-700' },
  closed:      { label: 'Closed',      color: 'bg-slate-100 text-slate-500' },
};

export const CATEGORY_CONFIG = {
  waste:         { label: 'Waste',           icon: '🗑️', color: 'text-orange-600' },
  water:         { label: 'Water',           icon: '💧', color: 'text-blue-600' },
  electricity:   { label: 'Electricity',     icon: '⚡', color: 'text-yellow-600' },
  roads:         { label: 'Roads',           icon: '🛣️', color: 'text-slate-600' },
  infrastructure:{ label: 'Infrastructure',  icon: '🏗️', color: 'text-indigo-600' },
  public_safety: { label: 'Public Safety',   icon: '🛡️', color: 'text-red-600' },
  parks:         { label: 'Parks',           icon: '🌳', color: 'text-green-600' },
  traffic:       { label: 'Traffic',         icon: '🚦', color: 'text-purple-600' },
  other:         { label: 'Other',           icon: '📋', color: 'text-slate-500' },
};

export const getPriorityBadge = (priority) => {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
};

export const getStatusBadge = (status) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
};

export const getCategoryConfig = (category) => {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
};

// ─── Misc ─────────────────────────────────────────────
export const truncate = (str, len = 100) =>
  str?.length > len ? str.slice(0, len) + '…' : str;

export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : '';

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

export const DEPARTMENTS = [
  { id: 'infrastructure', label: 'Infrastructure', icon: '🔧', staff: 14, load: 'High Load' },
  { id: 'sanitation', label: 'Sanitation & Waste', icon: '🗑️', staff: 8, load: 'Optimal' },
  { id: 'public_safety', label: 'Public Safety', icon: '🛡️', staff: 32, load: 'Moderate' },
  { id: 'parks', label: 'Parks & Recreation', icon: '🌲', staff: 12, load: 'Low Load' },
  { id: 'traffic', label: 'Traffic Management', icon: '🚦', staff: 21, load: 'Moderate' },
];
