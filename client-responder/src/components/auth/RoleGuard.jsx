import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RESPONDER_ROUTES } from '../../constants/routes';

export default function RoleGuard({ children, requiredRole = 'Responder' }) {
  const { hasRole, role } = useAuth();

  if (!hasRole(requiredRole)) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-error/15 text-error flex items-center justify-center mx-auto border border-error/30 shadow-lg">
          <span className="material-symbols-outlined text-3xl">gavel</span>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-primary">Access Restricted</h2>
          <p className="text-xs text-on-surface-variant">
            This module requires <strong className="text-primary">{requiredRole}</strong> role privileges. Your current role is <span className="font-bold text-secondary">{role}</span>.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
