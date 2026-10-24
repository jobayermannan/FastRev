import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAppSelector } from '../app/hooks';

/** Renders child routes only for a signed-in user with one of the allowed roles. */
export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/patients" replace />;
  return <Outlet />;
}
