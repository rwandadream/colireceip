import { useState, useEffect } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getParcels, getActivityLogs } from '../lib/data';
import type { DashboardStats, Parcel, ActivityLog } from '../lib/types';
import { Card } from '../components/ui/Card';
import { HeroDashboard } from '../components/dashboard/HeroDashboard';
import { MapCard } from '../components/dashboard/MapCard';
import { DeliveryTimeline } from '../components/dashboard/DeliveryTimeline';
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
          <h1 className="text-2xl font-bold text-slate-900">
            Bonjour, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Voici un aperçu opérationnel et visuel de vos livraisons
          </p>
        </div>
        <Link to="/parcels/new" className="btn-accent w-full sm:w-auto">
          <Plus size={18} />
          Nouveau colis
        </Link>
      </div>

      {/* Hero + Map + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HeroDashboard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <MapCard />
            <div className="flex flex-col gap-4">
              <div className="card p-4">
                <h3 className="font-semibold text-slate-900 mb-2">KPI Rapides</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500">Colis en transit</div>
                    <div className="text-lg font-bold">{stats.in_transit}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500">Livrés aujourd'hui</div>
                    <div className="text-lg font-bold">{stats.delivered}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500">En attente</div>
                    <div className="text-lg font-bold">{stats.pending}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500">Reste à encaisser</div>
                    <div className="text-lg font-bold">{formatCurrency(stats.total_outstanding)}</div>
                  </div>
                </div>
              </div>

              <div>
                {/* Timeline component */}
                <DeliveryTimeline current={2} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: financials & recent items */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-slate-900">Résumé financier</h3>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">Revenus totaux</div>
                <div className="font-semibold">{formatCurrency(stats.total_revenue)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">Paiements en attente</div>
                <div className="font-semibold">{stats.pending_payments} colis</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">Reste à encaisser</div>
                <div className="font-semibold">{formatCurrency(stats.total_outstanding)}</div>
              </div>
            </div>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900">Colis récents</h2>
              <Link to="/parcels" className="text-sm text-brand-600 hover:underline flex items-center gap-1">Voir tout <ArrowRight size={14} /></Link>
            </div>
            {recentParcels.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucun colis enregistré pour le moment</p>
            ) : (
              <div className="space-y-2">
                {recentParcels.map((parcel) => (
                  <Link key={parcel.id} to={`/parcels/${parcel.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{parcel.tracking_number}</p>
                      <p className="text-xs text-slate-500 truncate">{parcel.client_name} · {formatCurrency(parcel.total_amount)}</p>
                    </div>
                    <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>{PARCEL_STATUS_LABELS[parcel.status]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-bold text-slate-900 mb-3">Activité récente</h2>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucune activité enregistrée</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0">{log.user_name?.charAt(0).toUpperCase() || 'U'}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700"><span className="font-medium">{log.user_name}</span> {log.action.toLowerCase()}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
