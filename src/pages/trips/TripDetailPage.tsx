import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ClipboardList, Package, Route, Trash2, Truck } from 'lucide-react';
import { deleteTripVehicle, getParcelsByTripId, getTripById, getTripStatusLabel, getTripVehicles, updateTrip } from '../../lib/data';
import type { Parcel, Trip, TripVehicle } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TrackingBadge } from '../../components/ui/TrackingBadge';
import { Modal } from '../../components/ui/Modal';
import { OfflineNotice } from '../../components/ui/OfflineNotice';
import { Skeleton } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../lib/format';
import { userErrorMessage } from '../../lib/userMessage';
import { useToast } from '../../context/ToastContext';

type ViewMode = 'overview' | 'vehicles' | 'parcels';
type FeeKey = 'road_bamako_frontier' | 'customs_fee' | 'frontier_formalities' | 'road_frontier_bouake' | 'road_bouake_abidjan' | 'road_abidjan' | 'loading_fee' | 'unloading_fee' | 'truck_quota' | 'monthly_fee';

const feeGroups: { label: string; fields: FeeKey[] }[] = [
    { label: 'Route', fields: ['road_bamako_frontier', 'road_frontier_bouake', 'road_bouake_abidjan', 'road_abidjan'] },
    { label: 'Formalites', fields: ['customs_fee', 'frontier_formalities'] },
    { label: 'Manutention et autres', fields: ['loading_fee', 'unloading_fee', 'truck_quota', 'monthly_fee'] },
];

const feeLabels: Record<FeeKey, string> = {
    road_bamako_frontier: 'Bamako -> frontiere', customs_fee: 'Dedouanement', frontier_formalities: 'Formalites frontiere',
    road_frontier_bouake: 'Frontiere -> Bouake', road_bouake_abidjan: 'Bouake -> Abidjan', road_abidjan: 'Frais a Abidjan',
    loading_fee: 'Chargement', unloading_fee: 'Dechargement', truck_quota: 'Quota camion', monthly_fee: 'Frais mensuels',
};

function getVehicleFees(vehicle: TripVehicle): number {
    return feeGroups.reduce((total, group) => total + group.fields.reduce((subtotal, field) => subtotal + (Number(vehicle[field]) || 0), 0), 0);
  }

export function TripDetailPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [trip, setTrip] = useState<Trip | null>(null);
    const [vehicles, setVehicles] = useState<TripVehicle[]>([]);
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [view, setView] = useState<ViewMode>('overview');
    const [vehicleFilter, setVehicleFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [statusLoading, setStatusLoading] = useState(false);
    const [deletingVehicle, setDeletingVehicle] = useState<TripVehicle | null>(null);
    const [vehicleDeleteLoading, setVehicleDeleteLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const [tripData, vehicleData, parcelData] = await Promise.all([getTripById(id), getTripVehicles(id), getParcelsByTripId(id)]);
            setTrip(tripData || null);
            setVehicles(vehicleData);
            setParcels(parcelData);
        } catch (error) {
            console.error('Erreur de chargement du voyage', error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load, reloadKey]);

    const totalFees = useMemo(() => vehicles.reduce((sum, vehicle) => sum + getVehicleFees(vehicle), 0), [vehicles]);
    const filteredParcels = useMemo(() => vehicleFilter === 'all' ? parcels : parcels.filter((parcel) => parcel.trip_vehicle_id === vehicleFilter), [parcels, vehicleFilter]);

    if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

    if (loadError) {
        return (
            <div className="text-center py-16">
                <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">Impossible de charger ce voyage.</p>
                <div className="flex gap-3 justify-center mt-4">
                    <Link to="/trips" className="btn-secondary">Retour aux voyages</Link>
                    <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary">Réessayer</button>
                </div>
            </div>
        );
    }

    if (!trip) return <Card className="p-10 text-center">Voyage introuvable.</Card>;

    const deleteVehicle = (vehicle: TripVehicle) => setDeletingVehicle(vehicle);
    const confirmDeleteVehicle = async () => {
        if (!deletingVehicle || vehicleDeleteLoading) return;
        setVehicleDeleteLoading(true);
        try {
            await deleteTripVehicle(deletingVehicle.id);
            await load();
            addToast({
                type: 'success',
                title: 'Véhicule supprimé',
                description: `Le véhicule ${deletingVehicle.vehicle_number} a été retiré du voyage.`,
            });
            setDeletingVehicle(null);
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Erreur de suppression',
                description: userErrorMessage(error, 'Impossible de supprimer ce véhicule.'),
            });
        } finally {
            setVehicleDeleteLoading(false);
        }
    };
    const setStatus = async (status: Trip['status']) => {
        if (statusLoading) return;
        setStatusLoading(true);
        try {
            const updated = await updateTrip(trip.id, { status });
            if (updated) setTrip(updated);
            addToast({ type: 'success', title: 'Statut mis à jour', description: `Voyage déplacé vers « ${getTripStatusLabel(status)} ».` });
        } catch (error) {
            console.error('Erreur de mise à jour du statut', error);
            addToast({ type: 'error', title: 'Erreur de mise à jour', description: userErrorMessage(error, 'Impossible de mettre à jour le statut.') });
        } finally {
            setStatusLoading(false);
        }
    };
    const views: { value: ViewMode; label: string; icon: typeof Route }[] = [
        { value: 'overview', label: 'Synthese', icon: Route },
        { value: 'vehicles', label: 'Vehicules', icon: Truck },
        { value: 'parcels', label: 'Colis', icon: Package },
    ];

    return (
        <div className="space-y-6">
            <OfflineNotice />
            <header className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-lg sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <Link to="/trips" className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white" aria-label="Retour aux voyages"><ArrowLeft size={20} /></Link>
                        <div><p className="text-sm font-medium text-white/70">Voyage {trip.trip_number || 'sans numéro'}</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{trip.origin || 'Départ non renseigné'} <span className="text-white/50">→</span> {trip.destination || 'Destination non renseignée'}</h1><p className="mt-3 text-sm text-white/75">Depart le {formatDate(trip.trip_date)} · {getTripStatusLabel(trip.status)}</p></div>
                    </div>
                    <select className="input w-full border-white/20 bg-white/10 text-white shadow-none lg:w-auto" value={trip.status} disabled={statusLoading} onChange={(event) => void setStatus(event.target.value as Trip['status'])}>
                        <option className="text-slate-900" value="planned">Planifie</option><option className="text-slate-900" value="in_transit">En route</option><option className="text-slate-900" value="arrived">Arrive</option><option className="text-slate-900" value="closed">Cloture</option><option className="text-slate-900" value="cancelled">Annule</option>
                    </select>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 sm:grid-cols-4">
                    <div><p className="text-xs uppercase tracking-wide text-white/60">Vehicules</p><p className="mt-1 text-2xl font-bold">{vehicles.length}</p></div><div><p className="text-xs uppercase tracking-wide text-white/60">Colis</p><p className="mt-1 text-2xl font-bold">{parcels.length}</p></div><div><p className="text-xs uppercase tracking-wide text-white/60">Frais</p><p className="mt-1 text-lg font-bold sm:text-2xl">{formatCurrency(totalFees)}</p></div><div><p className="text-xs uppercase tracking-wide text-white/60">Etapes</p><p className="mt-1 text-lg font-bold sm:text-2xl">3</p></div>
                </div>
            </header>

            <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="Vues du voyage">
                {views.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setView(value)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${view === value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Icon size={17} /> {label}</button>)}
            </nav>

            {view === 'overview' && <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Parcours</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Une route en trois temps</h2></div><Route className="text-brand-500" size={24} /></div><div className="mt-7 flex items-center justify-between gap-2 text-center"><div><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">1</span><p className="mt-2 text-sm font-semibold">{trip.origin}</p></div><div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><div><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">2</span><p className="mt-2 text-sm font-semibold">Frontiere</p></div><div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><div><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">3</span><p className="mt-2 text-sm font-semibold">{trip.destination}</p></div></div></Card>
                <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Repartition</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Activite du voyage</h2></div><ClipboardList className="text-brand-500" size={24} /></div><div className="mt-6 space-y-4"><button type="button" onClick={() => setView('vehicles')} className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-4 text-left transition hover:bg-brand-50 dark:bg-slate-700/50 dark:hover:bg-slate-700"><span><b className="block text-slate-900 dark:text-white">Gestion des vehicules</b><span className="text-sm text-slate-500">{vehicles.length} affecte(s)</span></span><ChevronRight size={18} className="text-slate-400" /></button><button type="button" onClick={() => setView('parcels')} className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-4 text-left transition hover:bg-brand-50 dark:bg-slate-700/50 dark:hover:bg-slate-700"><span><b className="block text-slate-900 dark:text-white">Suivi des colis</b><span className="text-sm text-slate-500">{parcels.length} enregistrement(s)</span></span><ChevronRight size={18} className="text-slate-400" /></button></div></Card>
            </div>}

            {view === 'vehicles' && <section className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Flotte affectee</p><h2 className="text-xl font-bold text-slate-900 dark:text-white">Vehicules du voyage</h2></div><div className="grid gap-4 xl:grid-cols-2">{vehicles.map((vehicle) => { const vehicleParcels = parcels.filter((parcel) => parcel.trip_vehicle_id === vehicle.id); const vehicleFees = getVehicleFees(vehicle); return <Card key={vehicle.id} className="p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{vehicle.vehicle_number}</span><div><h3 className="font-bold text-slate-900 dark:text-white">Vehicule {vehicle.vehicle_number}</h3><p className="text-sm text-slate-500">{vehicle.registration}</p></div></div><button title="Supprimer ce vehicule" onClick={() => void deleteVehicle(vehicle)} className="rounded-lg p-2 text-error-600 transition hover:bg-error-50"><Trash2 size={16} /></button></div><div className="mt-5 grid grid-cols-3 gap-3 border-y border-slate-100 py-4 text-center dark:border-slate-700"><div><b className="text-lg text-slate-900 dark:text-white">{vehicleParcels.length}</b><p className="text-xs text-slate-500">Colis</p></div><div><b className="text-sm text-slate-900 dark:text-white">{formatCurrency(vehicleFees)}</b><p className="text-xs text-slate-500">Frais</p></div><div><b className="text-sm text-slate-900 dark:text-white">{formatCurrency(vehicleParcels.reduce((sum, parcel) => sum + (Number(parcel.transport_price) || 0) + (Number(parcel.additional_fees) || 0), 0))}</b><p className="text-xs text-slate-500">Transport</p></div></div><div className="mt-4 space-y-2">{feeGroups.map((group) => <div key={group.label} className="flex items-center justify-between text-sm"><span className="text-slate-500">{group.label}</span><span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(group.fields.reduce((sum, field) => sum + vehicle[field], 0))}</span></div>)}</div><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-600">Voir le detail des frais</summary><div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">{feeGroups.flatMap((group) => group.fields).map((field) => <div key={field} className="flex justify-between text-xs text-slate-500"><span>{feeLabels[field]}</span><span>{formatCurrency(vehicle[field])}</span></div>)}</div></details></Card>; })}</div>{vehicles.length === 0 && <Card className="p-10 text-center text-sm text-slate-500">Aucun vehicule affecte a ce voyage.</Card>}</section>}

            {view === 'parcels' && <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suivi logistique</p><h2 className="text-xl font-bold text-slate-900 dark:text-white">Colis du voyage</h2></div><div className="flex gap-2"><select className="input w-full sm:w-auto" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="all">Tous les vehicules</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>Vehicule {vehicle.vehicle_number} · {vehicle.registration}</option>)}</select><Button size="sm" onClick={() => navigate('/parcels/new')}>Nouveau colis</Button></div></div><Card className="divide-y divide-slate-100 p-2 dark:divide-slate-700">{filteredParcels.map((parcel) => { const vehicle = vehicles.find((item) => item.id === parcel.trip_vehicle_id); return <Link key={parcel.id} to={`/parcels/${parcel.id}`} className="flex flex-col gap-2 rounded-xl p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-700/50"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Package size={17} /></span><div><TrackingBadge tracking={parcel.tracking_number} size="sm" /><p className="text-xs text-slate-500 mt-1">{parcel.recipient_name || 'Destinataire non renseigne'}</p></div></div><div className="flex items-center justify-between gap-5 text-sm sm:justify-end"><span className="text-slate-500">{vehicle ? `Vehicule ${vehicle.vehicle_number} · ${vehicle.registration}` : 'Vehicule non affecte'}</span><span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(parcel.transport_price)}</span><ChevronRight size={16} className="text-slate-400" /></div></Link>; })}{filteredParcels.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Aucun colis pour ce filtre.</p>}</Card></section>}
        <Modal open={deletingVehicle !== null} onClose={() => { if (!vehicleDeleteLoading) setDeletingVehicle(null); }} title="Supprimer le véhicule" size="sm">
                <p className="text-sm text-slate-500">Voulez-vous vraiment retirer le véhicule {deletingVehicle?.vehicle_number} de ce voyage ? Ses colis ne seront pas supprimés.</p>
                <div className="flex gap-3 justify-end mt-5">
                    <button className="btn-secondary" onClick={() => setDeletingVehicle(null)} disabled={vehicleDeleteLoading}>Annuler</button>
                    <button className="btn-danger" onClick={() => void confirmDeleteVehicle()} disabled={vehicleDeleteLoading}>{vehicleDeleteLoading ? 'Suppression...' : 'Supprimer'}</button>
                </div>
            </Modal>
        </div>
    );
}
