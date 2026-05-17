import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ReportIssuePage from './pages/ReportIssuePage';
import TrackComplaintPage from './pages/TrackComplaintPage';
import DashboardPage from './pages/DashboardPage';
import CitizenDashboardPage from './pages/CitizenDashboardPage';
import IssueDetailPage from './pages/IssueDetailPage';
import IssueLogsPage from './pages/IssueLogsPage';
import MapViewPage from './pages/MapViewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UserManagementPage from './pages/UserManagementPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import NotFoundPage from './pages/NotFoundPage';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium">Loading SheharSetu…</p>
    </div>
  </div>
);

// Only blocks truly private admin pages — NOT report/track
const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/citizen-dashboard" replace />;
  return children;
};

// Redirect logged-in users away from login page
const PublicRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) {
    return <Navigate to={isAdmin ? '/dashboard' : '/citizen-dashboard'} replace />;
  }
  return children;
};

// Any logged-in user — citizens go to citizen dashboard
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Fully public pages — no login needed */}
    <Route path="/" element={<HomePage />} />
    <Route path="/track" element={<TrackComplaintPage />} />
    <Route path="/report" element={<ReportIssuePage />} />

    {/* Auth page — redirect if already logged in */}
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

    {/* Citizen dashboard — logged-in citizens only */}
    <Route path="/citizen-dashboard" element={<PrivateRoute><CitizenDashboardPage /></PrivateRoute>} />

    {/* Admin-only routes */}
    <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
    <Route path="/issues" element={<AdminRoute><IssueLogsPage /></AdminRoute>} />
    <Route path="/issues/:id" element={<AdminRoute><IssueDetailPage /></AdminRoute>} />
    <Route path="/map" element={<AdminRoute><MapViewPage /></AdminRoute>} />
    <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
    <Route path="/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
    <Route path="/ai-analysis" element={<AdminRoute><AIAnalysisPage /></AdminRoute>} />

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
