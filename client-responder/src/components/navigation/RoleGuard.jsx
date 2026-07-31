import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RESPONDER_ROUTES } from '../../constants/routes';

export default function RoleGuard({ allowedRoles = ['Responder', 'Coordinator', 'Administrator'] }) {
  const { role } = useAuth();

  const userRole = (role || '').toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

  // Alias mappings (e.g. backend 'admin' -> 'administrator', 'commander' -> 'coordinator')
  const isAllowed =
    normalizedAllowed.includes(userRole) ||
    (userRole === 'admin' && normalizedAllowed.includes('administrator')) ||
    (userRole === 'commander' && normalizedAllowed.includes('coordinator'));

  if (!isAllowed) {
    return <Navigate to={RESPONDER_ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
