import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  User as UserIcon,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  CreditCard,
  Printer,
  Trash2,
  Clock,
  CheckCircle2,
  Truck,
  History,
} from 'lucide-react';
import {
  getParcelById,
  getPaymentsByParcel,
  getStatusHistory,
  updateParcelStatus,
  deleteParcel,
  logActivity,
} from '../../lib/data';
import type { Parcel, Payment, StatusHistory, ParcelStatus } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, PARCEL_STATUSES, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge, Skeleton } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Input';
import { AttachmentManager } from '../../components/ui/AttachmentManager';
import { formatCurrency, formatDateTime, formatDate } from '../../lib/format';
import { generateReceiptPDF } from '../../lib/pdf';

export function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ParcelStatus>('received');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [p, pays, hist] = await Promise.all([
        getParcelById(id),
        getPaymentsByParcel(id),
        getStatusHistory(id),
      ]);
      setParcel(p || null);
      setPayments(pays);
      setHistory(hist);
      if (p) setNewStatus(p.status);
      setLoading(false);
    })();
  }, [id]);

  const handleStatusChange = async () => {
    if (!parcel || !user || parcel.status === newStatus) return;
    await updateParcelStatus(parcel.id, newStatus, user.id, user.full_name);
    await logActivity(user.id, user.full_name, `a changé le statut du colis ${parcel.tracking_number} à ${PARCEL_STATUS_LABELS[newStatus]}`, 'parcel', parcel.id, '');
    const [p, hist] = await Promise.all([
      getParcelById(parcel.id),
      getStatusHistory(parcel.id),
    ]);
    setParcel(p || null);
    setHistory(hist);
    setStatusModalOpen(false);
  };

  const handleDelete = async () => {
    if (!parcel || !user) return;
    await deleteParcel(parcel.id);
    await logActivity(user.id, user.full_name, `a supprimé le colis ${parcel.tracking_number}`, 'parcel', parcel.id, '');
    navigate('/parcels');
  };

  const handlePrint = () => {
    if (parcel) generateReceiptPDF(parcel, payments);
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;
  }

  if (!parcel) {
    return (
      <div className="text-center py-16">
        <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Colis introuvable</p>
        <Link to="/parcels" className="btn-primary mt-4">Retour aux colis</Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/parcels" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {parcel.tracking_number}
              </h1>
              <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                {PARCEL_STATUS_LABELS[parcel.status]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enregistré le {formatDate(parcel.received_date)} par {parcel.registered_by_name}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handlePrint}>
          <Printer size={16} />
          Imprimer le reçu
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(true)}>
          <Clock size={16} />
          Changer le statut
        </Button>
        <Link to={`/payments/new?parcel=${parcel.id}`} className="btn-secondary text-sm">
          <CreditCard size={16} />
          Enregistrer paiement
        </Link>
        {isAdmin && (
          <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
            <Trash2 size={16} />
            Supprimer
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['received', 'in_transit', 'arrived', 'delivered'] as ParcelStatus[]).map((status) => (
          <Button
            key={status}
            variant={parcel.status === status ? 'primary' : 'secondary'}
            size="sm"
            disabled={parcel.status === status}
            onClick={async () => {
              setNewStatus(status);
              await handleStatusChange();
            }}
          >
            {PARCEL_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client Info */}
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <UserIcon size={18} />
            Client
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Nom</p>
              <Link to={`/clients/${parcel.client_id}`} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                {parcel.client_name}
              </Link>
            </div>
            {parcel.client_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-slate-400" />
                <a href={`tel:${parcel.client_phone}`} className="text-slate-700 dark:text-slate-200 hover:underline">
                  {parcel.client_phone}
                </a>
              </div>
            )}
          </div>
        </Card>

        {/* Parcel Info */}
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Package size={18} />
            Colis
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Type</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{parcel.merchandise_type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Quantité</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{parcel.quantity}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Poids</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{parcel.weight ? `${parcel.weight} kg` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Trajet</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{parcel.origin} → {parcel.destination}</p>
            </div>
            {parcel.description && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">Description</p>
                <p className="font-medium text-slate-700 dark:text-slate-200">{parcel.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Financial Info */}
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign size={18} />
            Paiements
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Prix de transport</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(parcel.transport_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Frais supplémentaires</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(parcel.additional_fees)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Montant total</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(parcel.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Montant payé</span>
              <span className="font-bold text-success-600 dark:text-success-400">{formatCurrency(parcel.amount_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Reste à payer</span>
              <span className={`font-bold ${parcel.balance > 0 ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'}`}>
                {formatCurrency(parcel.balance)}
              </span>
            </div>
          </div>
          {payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Historique des paiements</p>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(p.amount)}</span>
                    <Badge className={`ml-2 ${PAYMENT_METHOD_COLORS[p.payment_method]}`}>
                      {PAYMENT_METHOD_LABELS[p.payment_method]}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(p.payment_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Status Timeline */}
        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <History size={18} />
            Suivi du colis
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Reçu le</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 ml-auto">{formatDate(parcel.received_date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Truck size={16} className="text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Départ le</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 ml-auto">{formatDate(parcel.departure_date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin size={16} className="text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Arrivée le</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 ml-auto">{formatDate(parcel.arrival_date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 size={16} className="text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Livré le</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 ml-auto">{formatDate(parcel.delivery_date)}</span>
            </div>
          </div>
          {history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Historique des statuts</p>
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full ${PARCEL_STATUS_COLORS[h.new_status].includes('green') ? 'bg-success-500' : PARCEL_STATUS_COLORS[h.new_status].includes('amber') ? 'bg-warning-500' : PARCEL_STATUS_COLORS[h.new_status].includes('blue') ? 'bg-brand-500' : PARCEL_STATUS_COLORS[h.new_status].includes('purple') ? 'bg-purple-500' : PARCEL_STATUS_COLORS[h.new_status].includes('cyan') ? 'bg-cyan-500' : 'bg-error-500'}`} />
                    {history.indexOf(h) < history.length - 1 && <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={PARCEL_STATUS_COLORS[h.new_status]}>{PARCEL_STATUS_LABELS[h.new_status]}</Badge>
                      {h.previous_status && (
                        <span className="text-xs text-slate-400">depuis {PARCEL_STATUS_LABELS[h.previous_status]}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {h.changed_by_name} · {formatDateTime(h.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Pièces jointes</h2>
        <AttachmentManager entityType="parcel" entityId={parcel.id} />
      </Card>

      {/* Status Change Modal */}
      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Changer le statut" size="sm">
        <div className="space-y-4">
          <Select
            label="Nouveau statut"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ParcelStatus)}
          >
            {PARCEL_STATUSES.map((s) => (
              <option key={s} value={s}>{PARCEL_STATUS_LABELS[s]}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-3">
            <button onClick={() => setStatusModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleStatusChange} className="btn-primary">Confirmer</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le colis"
        message={`Êtes-vous sûr de vouloir supprimer le colis ${parcel.tracking_number} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
