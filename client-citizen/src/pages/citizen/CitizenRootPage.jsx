import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export default function CitizenRootPage() {
  return <Navigate to={ROUTES.CITIZEN_HOME} replace />;
}
