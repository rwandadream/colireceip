import { useMemo, useState, useEffect } from 'react';
import { ArrowRight, Clock, Package, Users, CreditCard, Truck, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getParcels } from '../lib/data';
import type { DashboardStats, Parcel } from '../lib/types';
import { HeroDashboard } from '../components/dashboard/HeroDashboard';
import { DeliveryTimeline } from '../components/dashboard/DeliveryTimeline';
import { ParcelTrendChart } from '../components/dashboard/ParcelTrendChart';
import { TopAgentsCard } from '../components/dashboard/TopAgentsCard';
import { Badge, Skeleton } from '../components/ui/Badge';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '../lib/types';
import { formatCurrency } from '../lib/format';

const statItems = [
  { key: 'total_parcels', label: 'Nombre total de colis', icon: Package, color: 'brand' },
  { key: 'received_today', label: 'Colis reçus aujourd’hui', icon: Sparkles, color: 'accent' },
  { key: 'pending', label: 'Colis en attente', icon: Clock, color: 'warning' },
  { key: 'in_transit', label: 'Colis en route', icon: Truck, color: 'cyan' },
  { key: 'arrived', label: 'Colis arrivés', icon: ShieldCheck, color: 'brand' },
  { key: 'delivered', label: 'Colis livrés', icon: ShieldCheck, color: 'success' },
  { key: 'total_clients', label: 'Nombre total de clients', icon: Users, color: 'brand' },
  { key: 'collected_today', label: 'Montant encaissé aujourd’hui', icon: CreditCard, color: 'accent' },
  { key: 'pending_payments', label: 'Paiements en attente', icon: CreditCard, color: 'warning' },
];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [recentParcels, setRecentParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        getDashboardStats(),
        getParcels(),
      ]);
      setStats(s);
      setParcels(p);
      setRecentParcels(p.slice(0, 5));
      setLoading(false);
    })();
  }, []);

  const currentTimelineStep = useMemo(() => {
    if (!stats) return 2;
    if (stats.delivered > 0) return 4;
    if (stats.arrived > 0) return 3;
    if (stats.in_transit > 0) return 2;
    if (stats.pending > 0) return 1;
    return 0;
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeroDashboard stats={stats} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {statItems.map((item) => {
            const value = stats[item.key as keyof DashboardStats];
            return (
              <div key={item.key} className="card p-5 group hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {typeof value === 'number' ? (item.key === 'collected_today' ? formatCurrency(value) : value) : value}
                    </p>
                  </div>
                  <div className={`flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br ${item.color === 'brand' ? 'from-brand-500 to-brand-600' : item.color === 'accent' ? 'from-accent-500 to-accent-600' : item.color === 'success' ? 'from-success-500 to-success-600' : item.color === 'warning' ? 'from-warning-500 to-warning-600' : 'from-cyan-500 to-cyan-600'} text-white shadow-lg shadow-slate-950/30`}>
                    <item.icon size={22} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <ParcelTrendChart parcels={parcels} />
          <TopAgentsCard parcels={parcels} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <DeliveryTimeline current={currentTimelineStep} />

          <div className="card p-5">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-white">Colis récents</h3>
                <p className="mt-1 text-sm text-slate-400">Suivi rapide des dernières expéditions enregistrées.</p>
              </div>
              <Link to="/parcels" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-400 hover:text-accent-300">
                Voir tout
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {recentParcels.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center text-sm text-slate-400">Aucun colis enregistré pour le moment.</div>
              ) : (
                recentParcels.map((parcel) => (
                  <Link
                    key={parcel.id}
                    to={`/parcels/${parcel.id}`}
                    className="group block rounded-3xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-accent-500/30 hover:bg-slate-900/80"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{parcel.tracking_number}</p>
                        <p className="mt-1 text-sm text-slate-400 truncate">{parcel.client_name} · {formatCurrency(parcel.total_amount)}</p>
                      </div>
                      <Badge className={`${PARCEL_STATUS_COLORS[parcel.status]} border border-white/10`}>{PARCEL_STATUS_LABELS[parcel.status]}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
