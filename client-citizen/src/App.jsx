import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AlertProvider } from './contexts/AlertContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PermissionProvider } from './contexts/PermissionContext';

// Layouts, Feedback & Routing Guards
import CitizenLayout from './layouts/CitizenLayout';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import ProtectedRoute from './components/navigation/ProtectedRoute';
import PublicRoute from './components/navigation/PublicRoute';
import PageLoadingFallback from './components/feedback/PageLoadingFallback';

// Application Entry Landing Portal
const LandingPortalPage = lazy(() => import('./pages/LandingPortalPage'));

// Citizen Application Placeholder Pages (/citizen/*)
const CitizenRootPage = lazy(() => import('./pages/citizen/CitizenRootPage'));
const CitizenLoginPage = lazy(() => import('./pages/citizen/CitizenLoginPage'));
const CitizenRegisterPage = lazy(() => import('./pages/citizen/CitizenRegisterPage'));
const CitizenHomePage = lazy(() => import('./pages/citizen/CitizenHomePage'));
const CitizenProfilePage = lazy(() => import('./pages/citizen/CitizenProfilePage'));
const CitizenSettingsPage = lazy(() => import('./pages/citizen/CitizenSettingsPage'));
const CitizenStatusPage = lazy(() => import('./pages/citizen/CitizenStatusPage'));

// Preserved Citizen Auxiliary Views
const SOSPage = lazy(() => import('./pages/SOSPage'));
const VoiceRelayPage = lazy(() => import('./pages/VoiceRelayPage'));
const EmergencyGuidePage = lazy(() => import('./pages/EmergencyGuidePage'));
const LanguageSelectionPage = lazy(() => import('./pages/LanguageSelectionPage'));
const PermissionSetupPage = lazy(() => import('./pages/PermissionSetupPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <PermissionProvider>
                <AlertProvider>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                      {/* 1. Main Entry Landing Portal */}
                      <Route path="/" element={<LandingPortalPage />} />

                      {/* 2. Citizen Core Application Routes (/citizen/*) */}
                      <Route element={<CitizenLayout />}>
                        <Route path="/citizen" element={<CitizenRootPage />} />
                        <Route path="/citizen/home" element={<CitizenHomePage />} />
                        <Route path="/citizen/status" element={<CitizenStatusPage />} />
                        <Route path="/citizen/settings" element={<CitizenSettingsPage />} />
                        <Route path="/settings" element={<Navigate to="/citizen/settings" replace />} />
                        <Route path="/sos" element={<SOSPage />} />
                        <Route path="/voice-relay" element={<VoiceRelayPage />} />
                        <Route path="/emergency-guide" element={<EmergencyGuidePage />} />
                        <Route path="/language-selection" element={<LanguageSelectionPage />} />
                        <Route path="/permissions" element={<PermissionSetupPage />} />

                        {/* Public Auth Routes */}
                        <Route element={<PublicRoute />}>
                          <Route path="/citizen/login" element={<CitizenLoginPage />} />
                          <Route path="/citizen/register" element={<CitizenRegisterPage />} />
                        </Route>

                        {/* Protected Citizen Account Routes */}
                        <Route element={<ProtectedRoute />}>
                          <Route path="/citizen/profile" element={<CitizenProfilePage />} />
                        </Route>
                      </Route>

                      {/* Catch-all Redirect to Landing */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </AlertProvider>
              </PermissionProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
