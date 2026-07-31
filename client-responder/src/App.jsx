import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import ProtectedRoute from './components/navigation/ProtectedRoute';
import RoleGuard from './components/navigation/RoleGuard';
import ResponderLayout from './layouts/ResponderLayout';
import { RESPONDER_ROUTES } from './constants/routes';

// Placeholder Pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'));
const CitizensPage = lazy(() => import('./pages/CitizensPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-xs font-bold text-primary">Loading Command Center...</div>}>
              <Routes>
                {/* Public Auth Route */}
                <Route path={RESPONDER_ROUTES.LOGIN} element={<LoginPage />} />

                {/* Protected Command Center Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<ResponderLayout />}>
                    <Route path="/" element={<Navigate to={RESPONDER_ROUTES.DASHBOARD} replace />} />
                    <Route path={RESPONDER_ROUTES.DASHBOARD} element={<DashboardPage />} />
                    <Route path={RESPONDER_ROUTES.INCIDENTS} element={<IncidentsPage />} />
                    <Route path={RESPONDER_ROUTES.CITIZENS} element={<CitizensPage />} />
                    <Route path={RESPONDER_ROUTES.RESOURCES} element={<ResourcesPage />} />
                    <Route path={RESPONDER_ROUTES.REPORTS} element={<ReportsPage />} />
                    <Route path={RESPONDER_ROUTES.ANALYTICS} element={<AnalyticsPage />} />
                    <Route path={RESPONDER_ROUTES.SETTINGS} element={<SettingsPage />} />

                    {/* Role-Protected Admin / Coordinator Routes */}
                    <Route element={<RoleGuard allowedRoles={['Coordinator', 'Administrator']} />}>
                      <Route path={RESPONDER_ROUTES.USERS} element={<UsersPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* Catch-all Redirect to Login */}
                <Route path="*" element={<Navigate to={RESPONDER_ROUTES.LOGIN} replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
