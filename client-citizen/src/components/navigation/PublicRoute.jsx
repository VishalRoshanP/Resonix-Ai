import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import PageLoadingFallback from '../feedback/PageLoadingFallback';

export default function PublicRoute() {
  const { citizenUser, loading } = useAuth();

  if (loading) {
    return <PageLoadingFallback />;
  }

  // If already authenticated as non-guest citizen, redirect away from login/register to home
  if (citizenUser && !citizenUser.isGuest) {
    return <Navigate to={ROUTES.CITIZEN_HOME} replace />;
  }

  return <Outlet />;
}
