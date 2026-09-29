// Municipal-staff gate for the Smart Drain Monitoring module.
// Broader than the existing `adminOnly` (which is admin/manager only) —
// department_lead users also need to acknowledge alerts, run diagnostics,
// and manage incidents. Built on top of the existing `protect` middleware,
// which must run first to populate req.user.
const municipalOnly = (req, res, next) => {
  if (req.user && ['admin', 'manager', 'department_lead'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied: municipal staff only' });
};

module.exports = { municipalOnly };
