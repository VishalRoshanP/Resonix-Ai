import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RESPONDER_ROUTES } from '../../constants/routes';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-primary">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary text-2xl animate-spin">sync</span>
          <span className="text-sm font-bold">Verifying Responder Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={RESPONDER_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return children;
}
