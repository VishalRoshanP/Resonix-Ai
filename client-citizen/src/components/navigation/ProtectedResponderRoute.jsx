import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';

export default function ProtectedResponderRoute() {
  const { isResponderAuthenticated } = useAuth();

  if (!isResponderAuthenticated) {
    return <Navigate to={ROUTES.RESPONDER_LOGIN} replace />;
  }

  return <Outlet />;
}
