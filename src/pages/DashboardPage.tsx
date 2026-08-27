import { useState, useEffect } from 'react';
import {
  Package,
  PackageCheck,
  Truck,
  Users,
  Wallet,
  TrendingUp,
  Plus,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getParcels } from '../lib/data';
import type { DashboardStats, Parcel } from '../lib/types';
import { StatCard } from '../components/ui/Card';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Skeleton } from '../components/ui/Badge';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '../lib/types';
import { formatCurrency } from '../lib/format';
import { TrackingBadge } from '../components/ui/TrackingBadge';
import { useAuth } from '../context/AuthContext';

function AgentDashboard({ stats, user }: { stats: DashboardStats; user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Tableau de bord · Agent
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bonjour, {user.full_name.split(' ')[0]}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Activité et enregistrements associés à votre compte.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Mes colis" value={stats.total_parcels} icon={<Package size={16} />} />
        <StatCard label="Mes clients" value={stats.total_clients} icon={<Users size={16} />} />
        <StatCard label="Mes voyages" value={stats.total_trips} icon={<Truck size={16} />} />
        <StatCard label="Mes paiements" value={stats.total_payments} icon={<Wallet size={16} />} />
      </div>

      {/* Total revenue overview */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Montant de vos paiements enregistrés</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {formatCurrency(stats.total_revenue)}
            </p>
          </div>
          <span className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <TrendingUp size={18} />
          </span>
        </div>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentParcels, setRecentParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setLoading(true);

    (async () => {
      try {
        const [statsData, parcelsData] = await Promise.all([
          getDashboardStats(),
          getParcels(),
        ]);

        if (!active) return;
        setStats(statsData);
        setRecentParcels(parcelsData.slice(0, 5));
      } catch (error) {
        console.error('Erreur de chargement du tableau de bord:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!stats || loadError) {
    return (
      <div className="space-y-4">
        <Card className="p-6 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle size={32} className="text-error-500" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Impossible de charger le tableau de bord</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Vérifiez votre connexion puis réessayez.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
            <RefreshCw size={15} /> Réessayer
          </Button>
        </Card>
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

  return (
    <div className="space-y-4">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Tableau de bord
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bonjour, {user?.full_name?.split(' ')[0] || 'Groupe-Gaff'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Vue d'ensemble de votre activité logistique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/payments/new" className="btn-secondary">
            <Wallet size={15} />
            <span>Enregistrer paiement</span>
          </Link>
          <Link to="/parcels/new" className="btn-primary">
            <Plus size={15} />
            <span>Nouveau colis</span>
          </Link>
        </div>
      </div>

      {/* 2. Main KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total colis" value={stats.total_parcels} icon={<Package size={16} />} />
        <StatCard label="Reçus aujourd'hui" value={stats.received_today} icon={<PackageCheck size={16} />} />
        <StatCard label="Total clients" value={stats.total_clients} icon={<Users size={16} />} />
        <StatCard label="Encaissé aujourd'hui" value={formatCurrency(stats.collected_today)} icon={<Wallet size={16} />} />
      </div>

      {/* 3. Parcel Status Tracking (Single Unified Section) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Suivi logistique des colis
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Répartition opérationnelle par état d'acheminement ({stats.total_parcels} colis)
            </p>
          </div>
        </div>

        {/* Horizontal progress bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
          {stats.pending > 0 && (
            <div style={{ width: `${pctPending}%` }} className="bg-amber-500" title={`En attente: ${stats.pending}`} />
          )}
          {stats.in_transit > 0 && (
            <div style={{ width: `${pctTransit}%` }} className="bg-purple-500" title={`En route: ${stats.in_transit}`} />
          )}
          {stats.arrived > 0 && (
            <div style={{ width: `${pctArrived}%` }} className="bg-cyan-500" title={`Arrivés: ${stats.arrived}`} />
          )}
          {stats.delivered > 0 && (
            <div style={{ width: `${pctDelivered}%` }} className="bg-emerald-500" title={`Livrés: ${stats.delivered}`} />
          )}
        </div>

        {/* Compact 4-status metrics breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">En attente</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.pending} <span className="text-xs font-normal text-slate-500">({pctPending}%)</span>
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">En route</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.in_transit} <span className="text-xs font-normal text-slate-500">({pctTransit}%)</span>
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Arrivés</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.arrived} <span className="text-xs font-normal text-slate-500">({pctArrived}%)</span>
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Livrés</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.delivered} <span className="text-xs font-normal text-slate-500">({pctDelivered}%)</span>
            </p>
          </div>
        </div>
      </Card>

      {/* 4. Financial Performance Section */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Performance financière
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Synthèse du chiffre d'affaires et solde à recouvrer
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Revenus totaux</p>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(stats.total_revenue)}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Paiements en attente</p>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.pending_payments} <span className="text-sm font-normal text-slate-500">colis</span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reste à encaisser</p>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(stats.total_outstanding)}
            </p>
          </div>
        </div>

        {/* Secondary ratios */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Couverture paiement</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentCoverage}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Taux de livraison</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{deliveryRate}%</span>
          </div>
        </div>
      </Card>

      {/* 5. Operational Data: Recent Parcels & Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.6fr] gap-4">
        {/* Recent Parcels Table */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Derniers colis enregistrés
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vue opérationnelle récapitulative
              </p>
            </div>
            <Link to="/parcels" className="btn-ghost text-xs">
              <span>Voir tout</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {recentParcels.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              Aucun colis enregistré pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="pb-2.5 px-2">N° Colis</th>
                    <th className="pb-2.5 px-2">Client</th>
                    <th className="pb-2.5 px-2">Trajet</th>
                    <th className="pb-2.5 px-2">Statut</th>
                    <th className="pb-2.5 px-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentParcels.map((parcel) => {
                    const isFullyPaid = parcel.balance <= 0;
                    return (
                      <tr key={parcel.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-2 font-semibold">
                          <Link to={`/parcels/${parcel.id}`}>
                            <TrackingBadge tracking={parcel.tracking_number} size="sm" />
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-200 font-medium">
                          {parcel.client_name}
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400">
                          {parcel.origin} ➔ {parcel.destination}
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                            {PARCEL_STATUS_LABELS[parcel.status]}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums">
                          <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(parcel.total_amount)}</p>
                          {isFullyPaid ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Payé</span>
                          ) : (
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                              Reste: {formatCurrency(parcel.balance)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Quick Operations Sidebar Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              Raccourcis & Alertes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Opérations fréquentes
            </p>

            <div className="space-y-2">
              <Link to="/parcels/new" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <Plus size={14} className="text-brand-500" />
                  Nouveau colis
                </span>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link to="/clients/new" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400" />
                  Nouveau client
                </span>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link to="/payments/new" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <Wallet size={14} className="text-emerald-500" />
                  Enregistrer paiement
                </span>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              {formatCurrency(stats.total_outstanding)}
            </p>
            <p className="text-rose-600/80 dark:text-rose-400 mt-0.5">
              Reste global à encaisser sur les colis ouverts.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
