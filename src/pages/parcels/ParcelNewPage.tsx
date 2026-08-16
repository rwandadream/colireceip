import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, UserPlus, Save, Copy, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  getClients,
  getProducts,
  getProductByName,
  createParcel,
  createParcelItem,
  createProduct,
  logActivity,
  getSettings,
  createClient,
  getTrips,
  getTripVehicles,
} from '../../lib/data';
import type { Client, Product, PaymentCondition, Trip, TripVehicle } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, generateId } from '../../lib/format';
import { createParcelOnline } from '../../lib/parcelPersistence';
import { isApiUnavailable } from '../../lib/clientPersistence';
import { useToast } from '../../context/ToastContext';

export function ParcelNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [step, setStep] = useState(1);
  const [activeSuggestionItemId, setActiveSuggestionItemId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripVehicles, setTripVehicles] = useState<TripVehicle[]>([]);

  const [form, setForm] = useState({
    client_id: '',
    recipient_name: '',
    recipient_phone: '',
    recipient_address: '',
    departure_branch: '',
    arrival_branch: '',
    description: '',
    package_type: '' as 'Petit colis' | 'Gros colis' | '',
    weight: '' as string | number,
    transport_price: '' as string | number,
    additional_fees: '' as string | number,
    amount_paid: '' as string | number,
    payment_condition: 'unpaid' as PaymentCondition,
    origin: '',
    destination: '',
    trip_id: '',
    trip_vehicle_id: '',
    vehicle: '',
  });

  const [newClient, setNewClient] = useState({
    full_name: '',
    phone: '',
    city: '',
  });

  const [items, setItems] = useState<{
    id: string;
    product_id?: string;
    designation: string;
    quantity: string | number;
    unit_price: string | number;
    amount: number;
  }[]>([
    { id: generateId(), designation: '', quantity: '', unit_price: '', amount: 0 },
  ]);

  const [products, setProducts] = useState<Product[]>([]);

  const normalizeText = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const getSuggestions = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(normalized))
      .slice(0, 6);
  };

  const selectSuggestion = (id: string, product: Product) => {
    updateItem(id, {
      product_id: product.id,
      designation: product.name,
      unit_price: product.default_price,
    });
    setActiveSuggestionItemId(null);
  };

  useEffect(() => {
    (async () => {
      const [clientsData, productsData, appSettings, tripsData] = await Promise.all([
        getClients(),
        getProducts(),
        getSettings(),
        getTrips(),
      ]);
      setClients(clientsData);
      setProducts(productsData);
      setTrips(tripsData);
      if (appSettings) {
        setForm((prev) => ({
          ...prev,
          origin: appSettings.default_origin || 'Bamako',
          destination: appSettings.default_destination || 'Abidjan',
          departure_branch: appSettings.default_origin || 'Bamako',
          arrival_branch: appSettings.default_destination || 'Abidjan',
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          origin: 'Bamako',
          destination: 'Abidjan',
          departure_branch: 'Bamako',
          arrival_branch: 'Abidjan',
        }));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!form.trip_id) {
      setTripVehicles([]);
      return;
    }
    void getTripVehicles(form.trip_id).then(setTripVehicles);
  }, [form.trip_id]);

  useEffect(() => {
    const search = normalizeText(newClient.full_name || newClient.phone || '');
    if (!search) {
      setClientSuggestions([]);
      return;
    }

    const matches = clients.filter((client) => {
      const samePhone = newClient.phone && client.phone && normalizeText(client.phone) === normalizeText(newClient.phone);
      const sameName = normalizeText(client.full_name).includes(search) || search.includes(normalizeText(client.full_name));
      return samePhone || sameName;
    }).slice(0, 4);

    setClientSuggestions(matches);
  }, [clients, newClient.full_name, newClient.phone]);

  const transportPriceNum = Number(form.transport_price) || 0;
  const additionalFeesNum = Number(form.additional_fees) || 0;
  const amountPaidNum = Number(form.amount_paid) || 0;

  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = subTotal + transportPriceNum + additionalFeesNum;
  const balance = totalAmount - amountPaidNum;
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const updateItem = (id: string, changes: Partial<typeof items[number]>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...changes };
        if (changes.product_id) {
          const product = products.find((p) => p.id === changes.product_id);
          if (product) {
            next.designation = product.name;
            next.unit_price = product.default_price;
          }
        }
        const quantity = Number(next.quantity) || 0;
        const unitPrice = Number(next.unit_price) || 0;
        next.amount = quantity * unitPrice;
        return next;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: generateId(), designation: '', quantity: '', unit_price: '', amount: 0 },
    ]);
  };

  const duplicateItem = (id: string) => {
    setItems((prev) => {
      const source = prev.find((item) => item.id === id);
      if (!source) return prev;
      return [
        ...prev,
        {
          ...source,
          id: generateId(),
        },
      ];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const paymentConditions = [
    { value: 'paid_origin', label: 'Payé au départ' },
    { value: 'paid_destination', label: 'Payé à destination' },
    { value: 'partial', label: 'Paiement partiel' },
    { value: 'unpaid', label: 'Non payé' },
  ];

  const applyClientSelection = (clientId: string) => {
    const selectedClient = clients.find((client) => client.id === clientId);
    const fallbackAddress = [selectedClient?.city, selectedClient?.neighborhood].filter(Boolean).join(', ');

    setForm((prev) => ({
      ...prev,
      client_id: clientId,
      recipient_name: selectedClient?.full_name || '',
      recipient_phone: selectedClient?.phone || '',
      recipient_address: selectedClient?.address || fallbackAddress || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.package_type || items.length === 0 || items.some((item) => !item.designation || Number(item.quantity) <= 0)) return;
    setSaving(true);

    try {
      const client = clients.find((c) => c.id === form.client_id);
      const parcelInput = {
        client_id: form.client_id,
        client_name: client?.full_name || '',
        client_phone: client?.phone || '',
        vehicle: form.vehicle,
        trip_id: form.trip_id || undefined,
        trip_vehicle_id: form.trip_vehicle_id || undefined,
        recipient_name: form.recipient_name,
        recipient_phone: form.recipient_phone,
        recipient_address: form.recipient_address,
        departure_branch: form.departure_branch,
        arrival_branch: form.arrival_branch,
        agent_id: user?.id || '',
        agent_name: user?.full_name || '',
        package_type: form.package_type,
        merchandise_type: items[0]?.designation || '',
        description: form.description,
        quantity: totalQuantity,
        weight: Number(form.weight),
        transport_price: transportPriceNum,
        additional_fees: additionalFeesNum,
        sub_total: subTotal,
        amount_paid: amountPaidNum,
        payment_condition: form.payment_condition,
        origin: form.origin,
        destination: form.destination,
        status: 'received' as const,
        received_date: new Date().toISOString(),
        departure_date: null,
        arrival_date: null,
        delivery_date: null,
        registered_by: user?.id || '',
        registered_by_name: user?.full_name || '',
      };
      const online = navigator.onLine;
      let onlineResult = null;
      if (online) {
        try {
          onlineResult = await createParcelOnline(parcelInput, items.map((item) => ({ product_id: item.product_id, designation: item.designation.trim(), quantity: Number(item.quantity), unit_price: Number(item.unit_price) })));
        } catch (error) {
          if (!isApiUnavailable(error)) throw error;
        }
      }
      const parcel = onlineResult?.parcel ?? await createParcel(parcelInput);

      setSaving(false);

      if (!onlineResult) void (async () => {
        try {
          await Promise.all(
            items.map(async (item) => {
              let product_id = item.product_id;
              const designation = item.designation.trim();
              if (!product_id && designation) {
                const existingProduct = await getProductByName(designation);
                if (existingProduct) {
                  product_id = existingProduct.id;
                } else {
                  const createdProduct = await createProduct({
                    name: designation,
                    category: 'Historique',
                    default_price: Number(item.unit_price) || 0,
                  });
                  product_id = createdProduct.id;
                  setProducts((prev) => [createdProduct, ...prev]);
                }
              }
              return createParcelItem({
                parcel_id: parcel.id,
                product_id,
                designation,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
              });
            })
          );

          await logActivity(
            user?.id || '',
            user?.full_name || '',
            `a créé le bordereau ${parcel.tracking_number}`,
            'parcel',
            parcel.id,
            `Expédition pour ${parcel.client_name}, total: ${formatCurrency(parcel.total_amount)}`
          );
        } catch (error) {
          console.error('Erreur d’enregistrement en arrière-plan', error);
        }
      })();

      addToast({
        type: 'success',
        title: 'Colis enregistré',
        description: `Le bordereau ${parcel.tracking_number} a été créé avec succès.`,
      });
      navigate(`/parcels/${parcel.id}`);
    } catch (error) {
      console.error('Erreur d’enregistrement du colis', error);
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.full_name) return;

    const existing = clients.find((client) => {
      const samePhone = newClient.phone && client.phone && normalizeText(client.phone) === normalizeText(newClient.phone);
      const sameName = normalizeText(client.full_name) === normalizeText(newClient.full_name);
      return samePhone || sameName;
    });

    if (existing) {
      applyClientSelection(existing.id);
      setShowNewClient(false);
      setNewClient({ full_name: '', phone: '', city: '' });
      return;
    }

    const client = await createClient({
      full_name: newClient.full_name,
      phone: newClient.phone,
      city: newClient.city,
      address: '',
      notes: '',
      created_by: user?.id || '',
      created_by_name: user?.full_name || '',
    });
    setClients((prev) => [client, ...prev]);
    setForm((prev) => ({
      ...prev,
      client_id: client.id,
      recipient_name: client.full_name,
      recipient_phone: client.phone,
      recipient_address: client.address || client.city,
    }));
    addToast({
      type: 'success',
      title: 'Client créé',
      description: 'Le client a été ajouté et les informations ont été préremplies.',
    });
    setShowNewClient(false);
    setNewClient({ full_name: '', phone: '', city: '' });
  };

  if (loading) return <div className="animate-pulse"><div className="skeleton h-96 rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/parcels" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau colis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer un nouveau colis</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Étape {step} / 3</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {step === 1 ? 'Sélectionnez le client et le destinataire' : step === 2 ? 'Définissez le transport et le contenu' : 'Validez le résumé avant enregistrement'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStep((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" disabled={step === 1}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setStep((prev) => Math.min(3, prev + 1))} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" disabled={step === 3}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </Card>

        {step === 1 && (
          <>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 dark:text-white">Client</h2>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewClient(true)}>
                  <UserPlus size={16} />
                  Nouveau client
                </Button>
              </div>
              <Select
                label="Sélectionner un client"
                value={form.client_id}
                onChange={(e) => applyClientSelection(e.target.value)}
                required
              >
                <option value="">— Choisir un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.phone ? `· ${c.phone}` : ''}
                  </option>
                ))}
              </Select>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-slate-900 dark:text-white mb-4">Destinataire</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Voyage (optionnel)" value={form.trip_id} onChange={(e) => setForm({ ...form, trip_id: e.target.value, trip_vehicle_id: '', vehicle: '' })}>
                  <option value="">— Aucun voyage —</option>
                  {trips.map((trip) => <option key={trip.id} value={trip.id}>Voyage {trip.trip_number} · {trip.origin} → {trip.destination}</option>)}
                </Select>
                <Select label="Véhicule du voyage" value={form.trip_vehicle_id} disabled={!form.trip_id} onChange={(e) => { const selected = tripVehicles.find((vehicle) => vehicle.id === e.target.value); setForm({ ...form, trip_vehicle_id: e.target.value, vehicle: selected?.registration || '' }); }}>
                  <option value="">— Aucun véhicule —</option>
                  {tripVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>Véhicule {vehicle.vehicle_number} · {vehicle.registration}</option>)}
                </Select>
                <Input
                  label="Nom du destinataire"
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  required
                />
                <Input
                  label="Téléphone du destinataire"
                  value={form.recipient_phone}
                  onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Adresse du destinataire"
                    value={form.recipient_address}
                    onChange={(e) => setForm({ ...form, recipient_address: e.target.value })}
                  />
                </div>
              </div>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 dark:text-white mb-4">Informations de livraison</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Agence départ"
                  value={form.departure_branch}
                  onChange={(e) => setForm({ ...form, departure_branch: e.target.value })}
                />
                <Input
                  label="Agence arrivée"
                  value={form.arrival_branch}
                  onChange={(e) => setForm({ ...form, arrival_branch: e.target.value })}
                />
                <Select
                  label="Type de colis"
                  value={form.package_type}
                  onChange={(e) => setForm({ ...form, package_type: e.target.value as 'Petit colis' | 'Gros colis' | '' })}
                  required
                >
                  <option value="">— Choisir un type —</option>
                  <option value="Petit colis">Petit colis</option>
                  <option value="Gros colis">Gros colis</option>
                </Select>
                <Select
                  label="Condition de paiement"
                  value={form.payment_condition}
                  onChange={(e) => setForm({ ...form, payment_condition: e.target.value as PaymentCondition })}
                >
                  {paymentConditions.map((condition) => (
                    <option key={condition.value} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </Select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Origine"
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  />
                  <Input
                    label="Destination"
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Textarea
                  label="Description"
                  rows={2}
                  placeholder="Informations complémentaires sur l'expédition..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 dark:text-white">Liste des marchandises</h2>
                <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                  <Plus size={16} />
                  Ajouter une ligne
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3">Marchandise</th>
                      <th className="py-2 px-3">Quantité</th>
                      <th className="py-2 px-3">Prix unitaire</th>
                      <th className="py-2 px-3">Montant</th>
                      <th className="py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="py-2 px-3">
                          <div className="relative">
                            <Input
                              label=""
                              value={item.designation}
                              onChange={(e) => {
                                updateItem(item.id, { designation: e.target.value, product_id: undefined });
                                setActiveSuggestionItemId(item.id);
                              }}
                              onFocus={() => setActiveSuggestionItemId(item.id)}
                              onBlur={() => window.setTimeout(() => setActiveSuggestionItemId(null), 120)}
                              placeholder="Saisir une marchandise"
                              className="w-full"
                            />
                            {activeSuggestionItemId === item.id && item.designation.trim() && getSuggestions(item.designation).length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                {getSuggestions(item.designation).map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectSuggestion(item.id, suggestion)}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                                  >
                                    {suggestion.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, { unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 px-3">{formatCurrency(item.amount)}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => duplicateItem(item.id)}>
                              <Copy size={16} />
                            </Button>
                            <Button type="button" variant="danger" onClick={() => removeItem(item.id)}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 dark:text-white mb-4">Résumé</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs text-slate-400">Sous-total marchandises</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(subTotal)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs text-slate-400">Nombre total d'articles</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{totalQuantity}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs text-slate-400">Transport</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(transportPriceNum)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs text-slate-400">Frais supplémentaires</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(additionalFeesNum)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 sm:col-span-2">
                  <p className="text-xs text-slate-400">Montant total</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 sm:col-span-2">
                  <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>Montant payé</span>
                    <span>{formatCurrency(amountPaidNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>Reste à payer</span>
                    <span className={balance > 0 ? 'text-error-600 dark:text-error-400 font-semibold' : 'text-success-600 dark:text-success-400 font-semibold'}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex gap-3 justify-end pb-4">
              <Link to="/parcels" className="btn-secondary">Annuler</Link>
              <Button type="submit" loading={saving}>
                <Save size={18} />
                Enregistrer le colis
              </Button>
            </div>
          </>
        )}
      </form>

      <Modal open={showNewClient} onClose={() => setShowNewClient(false)} title="Nouveau client" size="md">
        <div className="space-y-4">
          {clientSuggestions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clients similaires</p>
              <div className="space-y-2">
                {clientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setNewClient({
                        full_name: client.full_name,
                        phone: client.phone || '',
                        city: client.city || '',
                      });
                      setClientSuggestions([]);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {client.full_name} {client.phone ? `· ${client.phone}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input
            label="Nom complet *"
            value={newClient.full_name}
            onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Téléphone"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            />
            <Input
              label="Ville"
              value={newClient.city}
              onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowNewClient(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleCreateClient} className="btn-primary">
              <Plus size={18} />
              Créer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
