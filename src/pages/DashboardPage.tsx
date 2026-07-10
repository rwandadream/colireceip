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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getParcels, getActivityLogs } from '../lib/data';
import type { DashboardStats, Parcel, ActivityLog } from '../lib/types';
import { StatCard } from '../components/ui/Card';
import { Card } from '../components/ui/Card';
import { Badge, Skeleton } from '../components/ui/Badge';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '../lib/types';
import { formatCurrency, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentParcels, setRecentParcels] = useState<Parcel[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p, l] = await Promise.all([
        getDashboardStats(),
        getParcels(),
        getActivityLogs(5),
      ]);
      setStats(s);
      setRecentParcels(p.slice(0, 5));
      setRecentLogs(l);
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return (
      <div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Bonjour, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Voici un aperçu de votre activité aujourd'hui
          </p>
        </div>
        <Link to="/parcels/new" className="btn-primary w-full sm:w-auto">
          <Plus size={18} />
          Nouveau colis
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total colis" value={stats.total_parcels} icon={<Package size={20} />} color="brand" />
        <StatCard label="Reçus aujourd'hui" value={stats.received_today} icon={<PackageCheck size={20} />} color="cyan" />
        <StatCard label="Total clients" value={stats.total_clients} icon={<Users size={20} />} color="accent" />
        <StatCard label="Encaissé aujourd'hui" value={formatCurrency(stats.collected_today)} icon={<Wallet size={20} />} color="success" />
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="En attente" value={stats.pending} icon={<Clock size={20} />} color="warning" />
        <StatCard label="En route" value={stats.in_transit} icon={<Truck size={20} />} color="purple" />
        <StatCard label="Arrivés" value={stats.arrived} icon={<MapPin size={20} />} color="cyan" />
        <StatCard label="Livrés" value={stats.delivered} icon={<CheckCircle2 size={20} />} color="success" />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-success-500 to-success-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium opacity-90">Revenus totaux</p>
            <TrendingUp size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-warning-500 to-warning-600 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium opacity-90">Paiements en attente</p>
            <AlertCircle size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">{stats.pending_payments} colis</p>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-error-500 to-error-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium opacity-90">Reste à encaisser</p>
            <Wallet size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(stats.total_outstanding)}</p>
        </Card>
      </div>

      {/* Recent Parcels & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 dark:text-white">Colis récents</h2>
            <Link to="/parcels" className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          {recentParcels.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Aucun colis enregistré pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {recentParcels.map((parcel) => (
                <Link
                  key={parcel.id}
                  to={`/parcels/${parcel.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {parcel.tracking_number}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {parcel.client_name} · {formatCurrency(parcel.total_amount)}
                    </p>
                  </div>
                  <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                    {PARCEL_STATUS_LABELS[parcel.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 dark:text-white">Activité récente</h2>
            {user?.role === 'admin' && (
              <Link to="/logs" className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                Voir tout <ArrowRight size={14} />
              </Link>
            )}
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Aucune activité enregistrée
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-semibold flex-shrink-0">
                    {log.user_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-medium">{log.user_name}</span> {log.action.toLowerCase()}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {timeAgo(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
