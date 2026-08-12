import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Package,
  CreditCard,
  Edit,
  Trash2,
  Save,
} from 'lucide-react';
import {
  getClientById,
  updateClient,
  deleteClient,
  getParcels,
  getPaymentsByClient,
  logActivity,
} from '../../lib/data';
import type { Client, Parcel, Payment } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge, Skeleton } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<Client | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [clientData, allParcelsData, paymentsData] = await Promise.all([
        getClientById(id),
        getParcels(),
        getPaymentsByClient(id),
      ]);
      setClient(clientData || null);
      setParcels(allParcelsData.filter((item) => item.client_id === id));
      setPayments(paymentsData);
      if (clientData) setEditForm(clientData);
      setLoading(false);
    })();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!editForm || !client) return;
    await updateClient(client.id, editForm);
    setClient({ ...client, ...editForm });
    await logActivity(user?.id || '', user?.full_name || '', `a modifié le client ${client.full_name}`, 'client', client.id, '');
    setEditOpen(false);
  };

  const handleDelete = async () => {
    if (!client || !user) return;
    await deleteClient(client.id);
    await logActivity(user.id, user.full_name, `a supprimé le client ${client.full_name}`, 'client', client.id, '');
    navigate('/clients');
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!client) {
    return (
      <div className="text-center py-16">
        <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500">Client introuvable</p>
        <Link to="/clients" className="btn-primary mt-4">Retour aux clients</Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const totalSpent = parcels.reduce((sum, p) => sum + p.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/clients" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{client.full_name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Client depuis {formatDate(client.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Edit size={16} /> Modifier
          </Button>
          {isAdmin && (
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.phone && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <a href={`tel:${client.phone}`} className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:underline">
                  {client.phone}
                </a>
              </div>
            </div>
          )}
          {client.city && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center text-accent-600 dark:text-accent-400">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ville</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{client.city}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Package size={20} className="mx-auto text-brand-500 mb-1" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{parcels.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Colis</p>
        </Card>
        <Card className="p-4 text-center">
          <CreditCard size={20} className="mx-auto text-success-500 mb-1" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Payé</p>
        </Card>
        <Card className="p-4 text-center">
          <Calendar size={20} className="mx-auto text-accent-500 mb-1" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
        </Card>
      </div>

      {/* Parcels History */}
      <Card className="p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Colis envoyés ({parcels.length})</h2>
        {parcels.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Aucun colis pour ce client</p>
        ) : (
          <div className="space-y-2">
            {parcels.map((p) => (
              <Link
                key={p.id}
                to={`/parcels/${p.id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.tracking_number}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(p.received_date)} · {formatCurrency(p.total_amount)}
                  </p>
                </div>
                <Badge className={PARCEL_STATUS_COLORS[p.status]}>{PARCEL_STATUS_LABELS[p.status]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Payments History */}
      {payments.length > 0 && (
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Historique des paiements ({payments.length})</h2>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-success-100 dark:bg-success-900/40 flex items-center justify-center text-success-700 dark:text-success-300">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(p.payment_date)}</p>
                  </div>
                </div>
                <Badge className={PAYMENT_METHOD_COLORS[p.payment_method]}>
                  {PAYMENT_METHOD_LABELS[p.payment_method]}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier le client" size="md">
        {editForm && (
          <div className="space-y-4">
            <Input
              label="Nom complet *"
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Téléphone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <Input
                label="Ville"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditOpen(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleSaveEdit} className="btn-primary">
                <Save size={18} /> Enregistrer
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le client"
        message={`Êtes-vous sûr de vouloir supprimer ${client.full_name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
