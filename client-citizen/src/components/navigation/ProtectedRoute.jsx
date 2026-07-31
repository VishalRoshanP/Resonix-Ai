import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import PageLoadingFallback from '../feedback/PageLoadingFallback';

export default function ProtectedRoute() {
  const { citizenUser, isCitizenGuest, loading } = useAuth();

  if (loading) {
    return <PageLoadingFallback />;
  }

  // If user is guest and attempts protected account route, redirect to login
  if (isCitizenGuest || !citizenUser) {
    return <Navigate to={ROUTES.CITIZEN_LOGIN} replace />;
  }

  return <Outlet />;
}
