import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  CreditCard,
  UserCog,
  FileText,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
  { to: '/parcels', label: 'Colis', icon: <Package size={20} /> },
  { to: '/clients', label: 'Clients', icon: <Users size={20} /> },
  { to: '/payments', label: 'Paiements', icon: <CreditCard size={20} /> },
  { to: '/agents', label: 'Agents', icon: <UserCog size={20} />, adminOnly: true },
  { to: '/reports', label: 'Rapports', icon: <FileText size={20} />, adminOnly: true },
  { to: '/logs', label: 'Journal', icon: <ScrollText size={20} />, adminOnly: true },
  { to: '/settings', label: 'Paramètres', icon: <Settings size={20} />, adminOnly: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const filteredNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');
  const isAdmin = user?.role === 'admin';

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md">
            <Truck size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-slate-900 dark:text-white truncate">Transit Mali CI</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bamako → Abidjan</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role === 'admin' ? 'Administrateur' : 'Agent'}</p>
            </div>
          </div>
          <button onClick={toggleTheme} className="nav-link w-full">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
          <button onClick={logout} className="nav-link w-full text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={closeSidebar} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-800 shadow-2xl animate-slide-down flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
                  <Truck size={22} />
                </div>
                <div>
                  <h1 className="font-bold text-sm text-slate-900 dark:text-white">Transit Mali CI</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bamako → Abidjan</p>
                </div>
              </div>
              <button onClick={closeSidebar} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
              {filteredNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={closeSidebar}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user?.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isAdmin ? 'Administrateur' : 'Agent'}</p>
                </div>
              </div>
              <button onClick={toggleTheme} className="nav-link w-full">
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </button>
              <button onClick={logout} className="nav-link w-full text-error-600 dark:text-error-400">
                <LogOut size={20} />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
                <Truck size={18} />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Transit Mali CI</span>
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div key={location.pathname} className="page-enter p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
