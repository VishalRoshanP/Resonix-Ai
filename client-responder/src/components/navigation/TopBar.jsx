import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RESPONDER_ROUTES } from '../../constants/routes';
import Button from '../ui/Button';

export default function TopBar({ onToggleMobileMenu }) {
  const { responderUser, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(RESPONDER_ROUTES.LOGIN);
  };

  return (
    <header className="sticky top-0 bg-surface/95 backdrop-blur-md border-b border-outline-variant/60 py-3.5 px-4 sm:px-6 flex justify-between items-center z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-1 text-on-surface-variant hover:text-primary md:hidden cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <span className="text-xs font-bold text-secondary uppercase tracking-wider hidden sm:inline-block">Protected Portal</span>
        <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md border border-outline-variant/60">
          Role: {role}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-primary">{responderUser?.name || 'Commander Reyes'}</p>
          <p className="text-[10px] text-on-surface-variant">{responderUser?.email}</p>
        </div>

        <Button variant="secondary" size="sm" icon="logout" onClick={handleLogout} className="min-h-[36px]">
          Sign Out
        </Button>
      </div>
    </header>
  );
}

