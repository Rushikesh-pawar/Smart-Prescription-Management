import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { doctor, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-brand-700">
            Smart Prescription
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'text-brand-700 font-medium' : 'text-slate-600 hover:text-slate-900'
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/patients/new"
              className={({ isActive }) =>
                isActive ? 'text-brand-700 font-medium' : 'text-slate-600 hover:text-slate-900'
              }
            >
              New Patient
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                isActive ? 'text-brand-700 font-medium' : 'text-slate-600 hover:text-slate-900'
              }
            >
              Analytics
            </NavLink>
            <NavLink
              to="/chat"
              className={({ isActive }) =>
                isActive ? 'text-brand-700 font-medium' : 'text-slate-600 hover:text-slate-900'
              }
            >
              Chat
            </NavLink>
            <span className="text-slate-300">|</span>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive
                  ? 'text-brand-700 font-medium'
                  : 'text-slate-500 hover:text-slate-900'
              }
            >
              Dr. {doctor?.name}
            </NavLink>
            <button onClick={handleLogout} className="btn-ghost">
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Educational project — not for clinical use.
      </footer>
    </div>
  );
}
