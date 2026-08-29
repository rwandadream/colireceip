import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Truck, CalendarDays, Search, ArrowUpRight } from 'lucide-react';
import { getTrips, getTripVehicles, getParcelsByTripId, getTripStatusLabel } from '../../lib/data';
import type { Trip, TripStatus } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../lib/format';

const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_transit: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  arrived: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
  closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/50 dark:text-error-300',
};

export function TripsListPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<Record<string, { vehicles: number; parcels: number; expenses: number }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await getTrips();
        const entries = await Promise.all(
          data.map(async (trip) => {
            const [vehicles, parcels] = await Promise.all([
              getTripVehicles(trip.id),
              getParcelsByTripId(trip.id),
            ]);
            const expenses = vehicles.reduce(
              (sum, vehicle) =>
                sum +
                (Number(vehicle.customs_fee) || 0) +
                (Number(vehicle.frontier_formalities) || 0) +
                (Number(vehicle.road_bamako_frontier) || 0) +
                (Number(vehicle.road_frontier_bouake) || 0) +
                (Number(vehicle.road_bouake_abidjan) || 0) +
                (Number(vehicle.road_abidjan) || 0) +
                (Number(vehicle.loading_fee) || 0) +
                (Number(vehicle.unloading_fee) || 0) +
                (Number(vehicle.truck_quota) || 0) +
                (Number(vehicle.monthly_fee) || 0),
              0
            );
            return [trip.id, { vehicles: vehicles.length, parcels: parcels.length, expenses }] as const;
          })
        );
        setTrips(data);
        setStats(Object.fromEntries(entries));
      } catch (err) {
        console.error('Erreur lors du chargement des voyages:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trips.filter((t) => {
      const text = `${t.trip_number} ${t.origin} ${t.destination}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trips, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Gestion des voyages
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Gestion des Voyages
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {trips.length} trajets et convoi logistiques enregistrés
          </p>
        </div>
        <Link to="/trips/new">
          <Button>
            <Plus size={16} /> Nouveau voyage
          </Button>
        </Link>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Rechercher par N° de voyage, origine, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-52"
          >
            <option value="all">Tous les statuts</option>
            <option value="planned">Planifié</option>
            <option value="in_transit">En route</option>
            <option value="arrived">Arrivé</option>
            <option value="closed">Clôturé</option>
            <option value="cancelled">Annulé</option>
          </Select>
        </div>
      </Card>

      {/* Data Table */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : loadError ? (
        <Card className="p-10 text-center">
          <p className="text-slate-500 dark:text-slate-400">Impossible de charger les voyages.</p>
          <p className="text-xs text-slate-400 mt-1">Vérifiez votre connexion puis réessayez.</p>
          <Button className="mt-4" onClick={() => setReloadKey((k) => k + 1)}>
            Réessayer
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck size={32} />}
            title="Aucun voyage trouvé"
            description={
              search ? 'Aucun trajet ne correspond à vos filtres.' : 'Créez votre premier voyage.'
            }
            action={
              !search ? (
                <Link to="/trips/new">
                  <Button>
                    <Plus size={16} /> Nouveau voyage
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="data-table-container">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° Voyage</th>
                  <th>Itinéraire</th>
                  <th>Date</th>
                  <th className="text-center">Camions</th>
                  <th className="text-center">Colis</th>
                  <th className="text-right">Frais Totaux</th>
                  <th>Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((trip) => {
                  const stat = stats[trip.id] || { vehicles: 0, parcels: 0, expenses: 0 };
                  return (
                    <tr key={trip.id}>
                      <td className="font-bold">
                        <Link
                          to={`/trips/${trip.id}`}
                          className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1.5"
                        >
                          <Truck size={14} className="text-slate-400" />
                          <span>{trip.trip_number || 'SANS-N°'}</span>
                        </Link>
                      </td>
                      <td className="font-medium">
                        {trip.origin} <span className="text-slate-400 font-normal">➔</span>{' '}
                        {trip.destination}
                      </td>
                      <td className="text-slate-500 whitespace-nowrap text-xs">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} className="text-slate-400" />
                          {formatDate(trip.trip_date)}
                        </span>
                      </td>
                      <td className="text-center font-semibold">{stat.vehicles}</td>
                      <td className="text-center font-semibold">{stat.parcels}</td>
                      <td className="text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(stat.expenses)}
                      </td>
                      <td>
                        <Badge className={TRIP_STATUS_COLORS[trip.status]}>
                          {getTripStatusLabel(trip.status)}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/trips/${trip.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-md transition-colors"
                        >
                          Détails
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}