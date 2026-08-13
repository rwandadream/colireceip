import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { createTrip, createTripVehicle } from '../../lib/data';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const feeFields = ['road_bamako_frontier', 'customs_fee', 'frontier_formalities', 'road_frontier_bouake', 'road_bouake_abidjan', 'road_abidjan', 'loading_fee', 'unloading_fee', 'truck_quota', 'monthly_fee'] as const;
const feeLabels: Record<typeof feeFields[number], string> = { road_bamako_frontier: 'Route Bamako → frontière', customs_fee: 'Dédouanement', frontier_formalities: 'Formalités frontière', road_frontier_bouake: 'Frontière → Bouaké', road_bouake_abidjan: 'Bouaké → Abidjan', road_abidjan: 'Frais à Abidjan', loading_fee: 'Chargement', unloading_fee: 'Déchargement', truck_quota: 'Quota camion', monthly_fee: 'Frais mensuels' };
type VehicleForm = { registration: string } & Record<typeof feeFields[number], string>;
function emptyVehicle(): VehicleForm {
  return { registration: '', ...Object.fromEntries(feeFields.map((field) => [field, ''])) } as VehicleForm;
}

export function TripNewPage() {
    const navigate = useNavigate(); const { user } = useAuth();
    const [form, setForm] = useState({ trip_number: '', trip_date: new Date().toISOString().slice(0, 10), origin: 'Bamako', destination: 'Abidjan', status: 'planned' as const });
    const [vehicles, setVehicles] = useState<VehicleForm[]>([emptyVehicle()]); const [saving, setSaving] = useState(false);
    const updateVehicle = (index: number, field: string, value: string) => setVehicles((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);

        try {
            const trip = await createTrip({
                ...form,
                trip_number: form.trip_number.trim(),
                origin: form.origin.trim(),
                destination: form.destination.trim(),
                created_by: user?.id || '',
                created_by_name: user?.full_name || '',
            });

            const vehiclesToCreate = vehicles.filter((vehicle) => {
                const normalizedRegistration = vehicle.registration.trim();
                const hasFee = feeFields.some((field) => Number(vehicle[field]) > 0);
                return Boolean(normalizedRegistration) || hasFee;
            });

            for (const vehicle of vehiclesToCreate) {
                await createTripVehicle({
                    trip_id: trip.id,
                    registration: vehicle.registration.trim(),
                    ...Object.fromEntries(feeFields.map((field) => [field, Number(vehicle[field]) || 0])),
                } as never);
            }

            navigate(`/trips/${trip.id}`);
        } finally {
            setSaving(false);
        }
    };
    return <div className="max-w-4xl mx-auto space-y-5"><div className="flex items-center gap-3"><Link to="/trips" className="p-2"><ArrowLeft size={20} /></Link><div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau voyage</h1><p className="text-sm text-slate-500">Créer le trajet progressivement, puis compléter les informations plus tard.</p></div></div>
        <form onSubmit={submit} className="space-y-5"><Card className="p-5"><div className="grid gap-4 md:grid-cols-2"><Input label="Numéro de voyage" placeholder="001" value={form.trip_number} onChange={(e) => setForm({ ...form, trip_number: e.target.value })} /><Input label="Date" type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} /><Input label="Départ" placeholder="Bamako" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /><Input label="Destination" placeholder="Abidjan" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /><Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}><option value="planned">Planifié</option><option value="in_transit">En route</option><option value="arrived">Arrivé</option><option value="closed">Clôturé</option><option value="cancelled">Annulé</option></Select></div></Card>
            <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900 dark:text-white">Véhicules</h2><Button type="button" variant="secondary" onClick={() => setVehicles([...vehicles, emptyVehicle()])}><Plus size={16} /> Ajouter</Button></div>
            {vehicles.map((vehicle, index) => <Card key={index} className="p-5"><div className="flex justify-between gap-3 mb-4"><h3 className="font-semibold">Véhicule {index + 1}</h3>{vehicles.length > 1 && <button type="button" onClick={() => setVehicles(vehicles.filter((_, i) => i !== index))} className="text-error-600"><Trash2 size={17} /></button>}</div><Input label="Immatriculation réelle" value={vehicle.registration} onChange={(e) => updateVehicle(index, 'registration', e.target.value)} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{feeFields.map((field) => <Input key={field} label={`${feeLabels[field]} (FCFA)`} type="number" min={0} value={vehicle[field]} onChange={(e) => updateVehicle(index, field, e.target.value)} />)}</div></Card>)}
            <div className="flex justify-end"><Button type="submit" loading={saving}><Save size={16} /> Enregistrer le voyage</Button></div>
        </form></div>;
}