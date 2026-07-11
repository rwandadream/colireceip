import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { SarahGroupeLogo } from '../ui/SarahGroupeLogo';
import { useAuth } from '../../context/AuthContext';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const filteredNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#08111F] text-white flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col bg-[#0D1726] border-r border-white/10 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#F97316] text-white shadow-xl shadow-[#2563EB]/20">
            <SarahGroupeLogo className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-sm truncate">Sarah-Groupe</h1>
            <p className="text-xs text-slate-400">Livraison & logistique</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-4 py-5 space-y-2">
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

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/80 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#F97316] text-white font-semibold">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
            </div>
          </div>
          <button onClick={logout} className="nav-link w-full text-rose-300 hover:bg-rose-500/10">
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0D1726] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white">
                  <SarahGroupeLogo className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-semibold text-white text-sm">Sarah-Groupe</h1>
                  <p className="text-xs text-slate-400">Livraison & logistique</p>
                </div>
              </div>
              <button onClick={closeSidebar} className="p-2 rounded-2xl text-slate-300 hover:bg-slate-900/70">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
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
            <div className="p-4 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/80 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#F97316] text-white font-semibold">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
                </div>
              </div>
              <button onClick={logout} className="nav-link w-full text-rose-300 hover:bg-rose-500/10">
                <LogOut size={20} />
                <span>Déconnexion</span>
              </button>            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#08111F] border-b border-white/10 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-2xl bg-slate-950/70 text-slate-200 hover:bg-slate-900 transition"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white">
                <SarahGroupeLogo className="h-4 w-4" />
              </div>
              <span className="font-semibold text-white">Sarah-Groupe</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 z-20 bg-[#08111F]/95 border-b border-white/10 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Plateforme logistique</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <h1 className="text-xl font-semibold text-white">Tableau de bord</h1>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-[320px]">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M21 21l-4.35-4.35"></path>
                      <circle cx="10" cy="10" r="6"></circle>
                    </svg>
                  </span>
                  <input type="search" placeholder="Rechercher colis, clients ou agents" className="input pl-11 pr-4 w-full" aria-label="Rechercher" />
                </div>
 
                <Link to="/parcels" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition-all duration-200">
                  Voir les expéditions
                </Link>
 
                <Link to="/logs" className="relative rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-slate-300 hover:bg-slate-900 transition-all duration-200" aria-label="Voir les notifications">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-[#08111F]"></span>
                </Link>

                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/80 px-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#F97316] text-white font-semibold">
                    {user?.full_name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div key={location.pathname} className="page-enter p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
