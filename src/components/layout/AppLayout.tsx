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
  DollarSign,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoBrand } from '../ui/Logo';

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
  { to: '/expenses', label: 'Dépenses', icon: <DollarSign size={20} />, adminOnly: true },
  { to: '/trips', label: 'Voyages', icon: <Truck size={20} /> },
  { to: '/agents', label: 'Agents', icon: <UserCog size={20} />, adminOnly: true },
  { to: '/reports', label: 'Rapports', icon: <FileText size={20} />, adminOnly: true },
  { to: '/logs', label: 'Journal', icon: <ScrollText size={20} />, adminOnly: true },
  { to: '/settings', label: 'Paramètres', icon: <Settings size={20} />, adminOnly: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const filteredNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen overflow-hidden">
        <div className="flex items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex-shrink-0">
          <LogoBrand size={28} />
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={logout} className="nav-link w-full text-slate-500 hover:text-error-600 dark:text-slate-400 dark:hover:text-error-400">
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fade-in" onClick={closeSidebar} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex-shrink-0">
              <LogoBrand size={28} />
              <button onClick={closeSidebar} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
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
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <button onClick={logout} className="nav-link w-full text-slate-500 hover:text-error-600 dark:text-slate-400 dark:hover:text-error-400">
                <LogOut size={18} />
                <span>Déconnexion</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex-shrink-0 sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
            <LogoBrand size={24} showSubtitle={false} />
            <div className="w-9" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div key={location.pathname} className="page-enter p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
