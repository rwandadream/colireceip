import { useState, useEffect } from 'react';
import {
  Package,
  PackageCheck,
  Clock,
  Truck,
  MapPin,
  CheckCircle2,
  Users,
  Wallet,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getParcels } from '../lib/data';
import type { DashboardStats, Parcel } from '../lib/types';
import { StatCard } from '../components/ui/Card';
import { Card } from '../components/ui/Card';
import { Badge, Skeleton } from '../components/ui/Badge';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '../lib/types';
import { formatCurrency } from '../lib/format';
import { useAuth } from '../context/AuthContext';

function AgentDashboard({ stats, user }: { stats: DashboardStats; user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 sm:p-8">
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-semibold">
            Activité personnelle
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Bonjour, {user.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Voici uniquement les enregistrements associés à votre compte.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mes colis" value={stats.total_parcels} icon={<Package size={20} />} color="brand" />
        <StatCard label="Mes clients" value={stats.total_clients} icon={<Users size={20} />} color="accent" />
        <StatCard label="Mes voyages" value={stats.total_trips} icon={<Truck size={20} />} color="cyan" />
        <StatCard label="Mes paiements" value={stats.total_payments} icon={<Wallet size={20} />} color="success" />
      </div>

      <Card className="p-6 bg-emerald-500 text-white border-0 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">Montant de mes paiements enregistrés</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{formatCurrency(stats.total_revenue)}</p>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentParcels, setRecentParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const [statsData, parcelsData] = await Promise.all([
        getDashboardStats(),
        getParcels(),
      ]);

      if (!active) return;
      setStats(statsData);
      setRecentParcels(parcelsData.slice(0, 5));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="h-32 w-full rounded-3xl skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (user?.role === 'agent') {
    return <AgentDashboard stats={stats} user={user} />;
  }

  // Calculate percentages for status distribution bar
  const totalParcelsCount = stats.total_parcels || 1;
  const pctPending = Math.round((stats.pending / totalParcelsCount) * 100);
  const pctTransit = Math.round((stats.in_transit / totalParcelsCount) * 100);
  const pctArrived = Math.round((stats.arrived / totalParcelsCount) * 100);
  const pctDelivered = Math.round((stats.delivered / totalParcelsCount) * 100);
  const paymentCoverage = totalParcelsCount > 0 ? Math.round(((stats.total_parcels - stats.pending_payments) / totalParcelsCount) * 100) : 0;
  const deliveryRate = totalParcelsCount > 0 ? Math.round((stats.delivered / totalParcelsCount) * 100) : 0;

  // Helper to render inline visual markers for parcel status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-amber-500" />;
      case 'in_transit': return <Truck size={14} className="text-purple-500" />;
      case 'arrived': return <MapPin size={14} className="text-cyan-500" />;
      case 'delivered': return <CheckCircle2 size={14} className="text-emerald-500" />;
      default: return <Package size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Welcome Header with actions */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 dark:bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/5 dark:bg-accent-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
              Live Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Bonjour, {user?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Voici un aperçu de l'activité logistique pour aujourd'hui
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/payments/new" className="btn bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 font-semibold rounded-xl text-sm shadow-md hover:shadow-emerald-500/10 transition-all flex items-center justify-center gap-2">
              <Wallet size={18} />
              <span>Enregistrer paiement</span>
            </Link>
            <Link to="/parcels/new" className="btn bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 font-semibold rounded-xl text-sm shadow-md hover:shadow-brand-500/10 transition-all flex items-center justify-center gap-2 group">
              <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
              <span>Nouveau colis</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total colis" value={stats.total_parcels} icon={<Package size={20} />} color="brand" />
        <StatCard label="Reçus aujourd'hui" value={stats.received_today} icon={<PackageCheck size={20} />} color="cyan" />
        <StatCard label="Total clients" value={stats.total_clients} icon={<Users size={20} />} color="accent" />
        <StatCard label="Encaissé aujourd'hui" value={formatCurrency(stats.collected_today)} icon={<Wallet size={20} />} color="success" />
      </div>

      {/* Status Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="En attente" value={stats.pending} icon={<Clock size={20} />} color="warning" />
        <StatCard label="En route" value={stats.in_transit} icon={<Truck size={20} />} color="purple" />
        <StatCard label="Arrivés" value={stats.arrived} icon={<MapPin size={20} />} color="cyan" />
        <StatCard label="Livrés" value={stats.delivered} icon={<CheckCircle2 size={20} />} color="success" />
      </div>

      {/* Status Distribution Horizontal Visualizer */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Progression logistique des colis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Répartition des colis par état d'acheminement
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              {stats.total_parcels} colis
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden shadow-inner">
            {stats.pending > 0 && (
              <div 
                style={{ width: `${pctPending}%` }} 
                className="bg-amber-500 transition-all duration-500 hover:opacity-90 relative group"
                title={`En attente: ${stats.pending} (${pctPending}%)`}
              />
            )}
            {stats.in_transit > 0 && (
              <div 
                style={{ width: `${pctTransit}%` }} 
                className="bg-purple-500 transition-all duration-500 hover:opacity-90" 
                title={`En route: ${stats.in_transit} (${pctTransit}%)`}
              />
            )}
            {stats.arrived > 0 && (
              <div 
                style={{ width: `${pctArrived}%` }} 
                className="bg-cyan-500 transition-all duration-500 hover:opacity-90" 
                title={`Arrivés: ${stats.arrived} (${pctArrived}%)`}
              />
            )}
            {stats.delivered > 0 && (
              <div 
                style={{ width: `${pctDelivered}%` }} 
                className="bg-emerald-500 transition-all duration-500 hover:opacity-90" 
                title={`Livrés: ${stats.delivered} (${pctDelivered}%)`}
              />
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                En attente : <span className="text-slate-800 dark:text-slate-200 font-bold">{stats.pending}</span> ({pctPending}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                En route : <span className="text-slate-800 dark:text-slate-200 font-bold">{stats.in_transit}</span> ({pctTransit}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 flex-shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Arrivés : <span className="text-slate-800 dark:text-slate-200 font-bold">{stats.arrived}</span> ({pctArrived}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Livrés : <span className="text-slate-800 dark:text-slate-200 font-bold">{stats.delivered}</span> ({pctDelivered}%)
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-slate-200/70 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Vue direction</p>
            <h2 className="mt-2 text-xl font-bold">Suivi de gestion · performance du jour</h2>
            <p className="mt-2 text-sm text-slate-300">Pilotage rapide des colis, des paiements ouverts et de la livraison.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[320px]">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">Couverture paiement</p>
              <p className="mt-1 text-lg font-semibold">{paymentCoverage}%</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">Taux livraison</p>
              <p className="mt-1 text-lg font-semibold">{deliveryRate}%</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-300">À encaisser</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(stats.total_outstanding)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Summary with glowing card overlays */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white border-0 shadow-lg shadow-emerald-500/10 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-x-4 -translate-y-4 transition-transform duration-300 group-hover:scale-125 pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Revenus totaux</p>
            <div className="p-1.5 bg-white/15 rounded-lg"><TrendingUp size={18} /></div>
          </div>
          <p className="text-3xl font-extrabold tracking-tight relative z-10 tabular-nums">{formatCurrency(stats.total_revenue)}</p>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 text-white border-0 shadow-lg shadow-amber-500/10 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-x-4 -translate-y-4 transition-transform duration-300 group-hover:scale-125 pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Paiements en attente</p>
            <div className="p-1.5 bg-white/15 rounded-lg"><AlertCircle size={18} /></div>
          </div>
          <p className="text-3xl font-extrabold tracking-tight relative z-10 tabular-nums">{stats.pending_payments} colis</p>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 text-white border-0 shadow-lg shadow-rose-500/10 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-x-4 -translate-y-4 transition-transform duration-300 group-hover:scale-125 pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Reste à encaisser</p>
            <div className="p-1.5 bg-white/15 rounded-lg"><Wallet size={18} /></div>
          </div>
          <p className="text-3xl font-extrabold tracking-tight relative z-10 tabular-nums">{formatCurrency(stats.total_outstanding)}</p>
        </Card>
      </div>

      {/* Operational Quick View */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Colis récents</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Les 5 derniers colis enregistrés</p>
            </div>
            <Link to="/parcels" className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/40 flex items-center gap-1.5 transition-all">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          {recentParcels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <Package className="text-slate-300 dark:text-slate-700 mb-2" size={40} />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aucun colis enregistré pour le moment
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {recentParcels.map((parcel) => {
                const isFullyPaid = parcel.balance <= 0;
                return (
                  <Link
                    key={parcel.id}
                    to={`/parcels/${parcel.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-850 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700">
                          {getStatusIcon(parcel.status)}
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {parcel.tracking_number}
                        </p>
                        <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                          {PARCEL_STATUS_LABELS[parcel.status]}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {parcel.client_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                          <span className="capitalize">{parcel.merchandise_type || 'Colis'}</span>
                          {parcel.weight > 0 && <span>· {parcel.weight} kg</span>}
                          {parcel.quantity > 0 && <span>· {parcel.quantity} pces</span>}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          <span>{parcel.origin || 'N/A'}</span>
                          <span className="text-[10px]">➔</span>
                          <span>{parcel.destination || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 sm:mt-0 text-left sm:text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/40 dark:border-slate-700/40">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(parcel.total_amount)}</p>
                      
                      {isFullyPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md mt-0.5">
                          <Check size={10} strokeWidth={3} /> Payé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md mt-0.5">
                          Reste: {formatCurrency(parcel.balance)}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Actions rapides</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Priorités du jour</p>
            </div>
          </div>
          <div className="space-y-3">
            <Link to="/parcels/new" className="flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
              <span className="flex items-center gap-2">
                <Plus size={16} />
                Nouveau colis
              </span>
              <ArrowRight size={14} />
            </Link>
            <Link to="/clients/new" className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              <span className="flex items-center gap-2">
                <Users size={16} />
                Nouveau client
              </span>
              <ArrowRight size={14} />
            </Link>
            <Link to="/payments/new" className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <span className="flex items-center gap-2">
                <Wallet size={16} />
                Enregistrer paiement
              </span>
              <ArrowRight size={14} />
            </Link>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{stats.total_outstanding} FCFA à encaisser</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">Paiements encore ouverts</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
