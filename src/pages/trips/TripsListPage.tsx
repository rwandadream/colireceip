import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Truck, CalendarDays } from 'lucide-react';
import { getTrips, getTripVehicles, getParcelsByTripId, getTripStatusLabel } from '../../lib/data';
import type { Trip } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../lib/format';

export function TripsListPage() {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [stats, setStats] = useState<Record<string, { vehicles: number; parcels: number; expenses: number }>>({});

    useEffect(() => {
        void (async () => {
            const data = await getTrips();
            const entries = await Promise.all(data.map(async (trip) => {
                const [vehicles, parcels] = await Promise.all([getTripVehicles(trip.id), getParcelsByTripId(trip.id)]);
                const expenses = vehicles.reduce((sum, vehicle) => sum + vehicle.customs_fee + vehicle.frontier_formalities + vehicle.road_bamako_frontier + vehicle.road_frontier_bouake + vehicle.road_bouake_abidjan + vehicle.road_abidjan + vehicle.loading_fee + vehicle.unloading_fee + vehicle.truck_quota + vehicle.monthly_fee, 0);
                return [trip.id, { vehicles: vehicles.length, parcels: parcels.length, expenses }] as const;
            }));
            setTrips(data);
            setStats(Object.fromEntries(entries));
        })();
    }, []);

    return <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Voyages</h1><p className="text-sm text-slate-500">Trajets, véhicules, colis et frais regroupés.</p></div>
            <Link to="/trips/new"><Button><Plus size={16} /> Nouveau voyage</Button></Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => {
                const stat = stats[trip.id] || { vehicles: 0, parcels: 0, expenses: 0 }; return <Link key={trip.id} to={`/trips/${trip.id}`}>
                    <Card className="p-5 h-full hover:border-brand-300 transition-colors"><div className="flex justify-between gap-3"><div><p className="text-lg font-bold text-slate-900 dark:text-white">Voyage {trip.trip_number || 'sans numéro'}</p><p className="text-sm text-slate-500">{trip.origin || 'Départ non renseigné'} → {trip.destination || 'Destination non renseignée'}</p></div><span className="badge bg-brand-50 text-brand-700">{getTripStatusLabel(trip.status)}</span></div>
                        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} />{formatDate(trip.trip_date)}</div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><Truck size={16} className="mx-auto mb-1 text-brand-500" /><b>{stat.vehicles}</b><p className="text-xs text-slate-500">Véhicules</p></div><div><b>{stat.parcels}</b><p className="text-xs text-slate-500">Colis</p></div><div><b className="text-xs">{formatCurrency(stat.expenses)}</b><p className="text-xs text-slate-500">Frais</p></div></div>
                    </Card>
                </Link>;
            })}
            {trips.length === 0 && <Card className="p-10 text-center md:col-span-2 xl:col-span-3"><p className="text-slate-500">Aucun voyage enregistré.</p></Card>}
        </div>
    </div>;
}