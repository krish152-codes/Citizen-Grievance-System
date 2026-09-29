import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import HomePage             from './pages/HomePage';
import LoginPage            from './pages/LoginPage';
import ReportIssuePage      from './pages/ReportIssuePage';
import TrackComplaintPage   from './pages/TrackComplaintPage';
import DashboardPage        from './pages/DashboardPage';
import CitizenDashboardPage from './pages/CitizenDashboardPage';
import IssueDetailPage      from './pages/IssueDetailPage';
import IssueLogsPage        from './pages/IssueLogsPage';
import MapViewPage          from './pages/MapViewPage';
import AnalyticsPage        from './pages/AnalyticsPage';
import UserManagementPage   from './pages/UserManagementPage';
import AIAnalysisPage       from './pages/AIAnalysisPage';
import DepartmentPage       from './pages/DepartmentPage'; // ← NEW
import NotFoundPage         from './pages/NotFoundPage';

// Smart Drain Monitoring + Drain Echo
import DrainsOverviewPage      from './pages/DrainsOverviewPage';
import DrainDetailPage         from './pages/DrainDetailPage';
import DrainMapPage            from './pages/DrainMapPage';
import AlertsPage              from './pages/AlertsPage';
import DrainIncidentsPage      from './pages/DrainIncidentsPage';
import DrainIncidentDetailPage from './pages/DrainIncidentDetailPage';
import DrainEchoPage           from './pages/DrainEchoPage';
import DrainEchoHistoryPage    from './pages/DrainEchoHistoryPage';
import DrainMonitoringPage     from './pages/DrainMonitoringPage';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium">Loading SheharSetu…</p>
    </div>
  </div>
);

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user)    return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/citizen-dashboard" replace />;
  return children;
};

// Broader than AdminRoute — admin/manager/department_lead, for the Smart
// Drain Monitoring module's municipal-operations pages.
const MunicipalRoute = ({ children }) => {
  const { user, loading, isMunicipal } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user)        return <Navigate to="/login" replace />;
  if (!isMunicipal) return <Navigate to="/citizen-dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to={isAdmin ? '/dashboard' : '/citizen-dashboard'} replace />;
  return children;
};

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/"       element={<HomePage />} />
    <Route path="/track"  element={<TrackComplaintPage />} />
    <Route path="/report" element={<ReportIssuePage />} />
    <Route path="/drain-monitoring" element={<DrainMonitoringPage />} /> {/* ← NEW: public-safe drain status */}

    {/* Auth */}
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

    {/* Citizen */}
    <Route path="/citizen-dashboard" element={<PrivateRoute><CitizenDashboardPage /></PrivateRoute>} />
    <Route path="/drain-echo" element={<PrivateRoute><DrainEchoPage /></PrivateRoute>} /> {/* ← NEW: citizen + municipal */}

    {/* Admin */}
    <Route path="/dashboard"   element={<AdminRoute><DashboardPage /></AdminRoute>} />
    <Route path="/issues"      element={<AdminRoute><IssueLogsPage /></AdminRoute>} />
    <Route path="/issues/:id"  element={<AdminRoute><IssueDetailPage /></AdminRoute>} />
    <Route path="/map"         element={<AdminRoute><MapViewPage /></AdminRoute>} />
    <Route path="/analytics"   element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
    <Route path="/users"       element={<AdminRoute><UserManagementPage /></AdminRoute>} />
    <Route path="/ai-analysis" element={<AdminRoute><AIAnalysisPage /></AdminRoute>} />
    <Route path="/departments" element={<AdminRoute><DepartmentPage /></AdminRoute>} /> {/* ← NEW */}

    {/* Smart Drain Monitoring + Drain Echo — municipal operations */}
    <Route path="/drains"                element={<MunicipalRoute><DrainsOverviewPage /></MunicipalRoute>} />
    <Route path="/drains/map"            element={<MunicipalRoute><DrainMapPage /></MunicipalRoute>} />
    <Route path="/drains/:id"            element={<MunicipalRoute><DrainDetailPage /></MunicipalRoute>} />
    <Route path="/alerts"                element={<MunicipalRoute><AlertsPage /></MunicipalRoute>} />
    <Route path="/incidents"             element={<MunicipalRoute><DrainIncidentsPage /></MunicipalRoute>} />
    <Route path="/incidents/:id"         element={<MunicipalRoute><DrainIncidentDetailPage /></MunicipalRoute>} />
    <Route path="/drain-echo/history"    element={<MunicipalRoute><DrainEchoHistoryPage /></MunicipalRoute>} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
