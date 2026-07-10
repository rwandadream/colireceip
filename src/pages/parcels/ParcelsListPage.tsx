import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { getParcels } from '../../lib/data';
import type { Parcel } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, PARCEL_STATUSES } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../lib/format';

export function ParcelsListPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const data = await getParcels();
      setParcels(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return parcels.filter((p) => {
      const matchesSearch =
        !search ||
        p.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
        p.client_name.toLowerCase().includes(search.toLowerCase()) ||
        p.client_phone?.includes(search) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [parcels, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Colis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {parcels.length} colis au total
          </p>
        </div>
        <Link to="/parcels/new" className="btn-primary w-full sm:w-auto">
          <Plus size={18} />
          Nouveau colis
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par numéro, client, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sm:w-48"
          >
            <option value="all">Tous les statuts</option>
            {PARCEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PARCEL_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={32} />}
            title="Aucun colis trouvé"
            description={search || statusFilter !== 'all' ? 'Aucun colis ne correspond à vos critères de recherche.' : 'Commencez par enregistrer votre premier colis.'}
            action={
              !search && statusFilter === 'all' ? (
                <Link to="/parcels/new" className="btn-primary">
                  <Plus size={18} />
                  Nouveau colis
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((parcel) => (
            <Link key={parcel.id} to={`/parcels/${parcel.id}`}>
              <Card hover className="p-4 h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{parcel.tracking_number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatDate(parcel.received_date)}
                    </p>
                  </div>
                  <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                    {PARCEL_STATUS_LABELS[parcel.status]}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <UserIcon size={14} className="text-slate-400" />
                    <span className="truncate">{parcel.client_name}</span>
                  </div>
                  {parcel.client_phone && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone size={14} className="text-slate-400" />
                      <span>{parcel.client_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Package size={14} className="text-slate-400" />
                    <span className="truncate">{parcel.merchandise_type || 'Marchandise'} · {parcel.quantity} colis</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(parcel.total_amount)}</p>
                  </div>
                  {parcel.balance > 0 && parcel.status !== 'cancelled' ? (
                    <div className="text-right">
                      <p className="text-xs text-error-500">Reste à payer</p>
                      <p className="font-semibold text-error-600 dark:text-error-400">{formatCurrency(parcel.balance)}</p>
                    </div>
                  ) : parcel.status !== 'cancelled' ? (
                    <Badge className="bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300">
                      Payé
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
