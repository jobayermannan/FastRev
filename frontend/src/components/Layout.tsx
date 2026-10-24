import { NavLink, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loggedOut } from '../features/auth/authSlice';

export function Layout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>F</span> FastRev
        </div>
        <nav className="nav">
          {isAdmin && <NavLink to="/" end>Dashboard</NavLink>}
          {isAdmin && <NavLink to="/appointments">Appointments</NavLink>}
          <NavLink to="/patients">Patients</NavLink>
          {isAdmin && <NavLink to="/doctors">Doctors</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="user">
            <span className="user-email" title={user?.email}>{user?.email}</span>
            <span className="muted">{user?.role}</span>
          </div>
          <button className="btn ghost" onClick={() => dispatch(loggedOut())}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
