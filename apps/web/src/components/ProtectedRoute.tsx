import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  requireAdmin?: boolean;
}

export function ProtectedRoute({ requireAdmin = false }: Props) {
  const { player } = useAuth();

  if (!player) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && player.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
