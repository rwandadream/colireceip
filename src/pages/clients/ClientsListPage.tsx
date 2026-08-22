import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Phone, MapPin, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { getClients, getParcels } from '../../lib/data';
import { useToast } from '../../context/ToastContext';
import type { Client, Parcel } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency } from '../../lib/format';

export function ClientsListPage() {
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_balance' | 'paid_up'>('all');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [c, p] = await Promise.all([getClients(), getParcels()]);
        if (!active) return;
        setClients(c);
        setParcels(p);
        setError(null);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Impossible de charger les clients pour le moment.';
        setError(message);
        addToast({
          type: 'error',
          title: 'Erreur de chargement',
          description: message,
        });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [addToast]);

  const getClientStats = useCallback(
    (clientId: string) => {
      const clientParcels = parcels.filter((p) => p.client_id === clientId);
      const totalAmount = clientParcels.reduce((sum, p) => sum + p.total_amount, 0);
      const outstanding = clientParcels.reduce(
        (sum, p) => sum + (p.status !== 'cancelled' ? p.balance : 0),
        0
      );
      return { count: clientParcels.length, totalAmount, outstanding };
    },
    [parcels]
  );

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clients.filter((c) => {
      const haystack = [
        c.full_name,
        c.phone,
        c.city,
        c.address,
        c.neighborhood,
        c.notes,
        c.company_name,
        c.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const stats = getClientStats(c.id);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'with_balance' && stats.outstanding > 0) ||
        (statusFilter === 'paid_up' && stats.outstanding === 0);

      return matchesSearch && matchesStatus;
    });
  }, [clients, getClientStats, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Répertoire Clients
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {clients.length} clients enregistrés · suivi commercial et financier
          </p>
        </div>
        <Link to="/clients/new" className="btn-primary">
          <Plus size={16} />
          Nouveau client
        </Link>
      </div>

      {/* Toolbar Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Rechercher par nom, téléphone, ville, entreprise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'with_balance' | 'paid_up')}
            className="w-full sm:w-52"
          >
            <option value="all">Tous les clients</option>
            <option value="with_balance">Avec solde impayé</option>
            <option value="paid_up">À jour</option>
          </Select>
        </div>
      </Card>

      {/* Content View */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : error ? (
        <Card className="p-6 text-center">
          <AlertCircle className="mx-auto text-error-500 mb-2" size={28} />
          <p className="text-sm font-semibold text-error-600 dark:text-error-400">{error}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Veuillez vérifier votre connexion et rafraîchir la page.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={32} />}
            title="Aucun client trouvé"
            description={
              search ? 'Aucun client ne correspond à vos filtres.' : 'Ajoutez votre premier client.'
            }
            action={
              !search ? (
                <Link to="/clients/new" className="btn-primary">
                  <Plus size={16} /> Nouveau client
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
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Ville / Adresse</th>
                  <th className="text-center">Colis</th>
                  <th className="text-right">Montant Total</th>
                  <th className="text-right">Solde Impayé</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const stats = getClientStats(client.id);
                  const hasOutstanding = stats.outstanding > 0;
                  return (
                    <tr key={client.id}>
                      <td className="font-semibold">
                        <Link
                          to={`/clients/${client.id}`}
                          className="flex items-center gap-2.5 group hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {client.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                              {client.full_name}
                            </p>
                            {client.company_name && (
                              <p className="text-[11px] font-normal text-slate-400 truncate">
                                {client.company_name}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>

                      <td>
                        <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {client.phone && (
                            <p className="flex items-center gap-1.5 font-medium">
                              <Phone size={12} className="text-slate-400" />
                              {client.phone}
                            </p>
                          )}
                          {client.email && (
                            <p className="text-slate-400 truncate text-[11px]">{client.email}</p>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            {client.city}
                            {client.neighborhood ? `, ${client.neighborhood}` : ''}
                          </span>
                        </div>
                      </td>

                      <td className="text-center font-semibold">
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {stats.count}
                        </Badge>
                      </td>

                      <td className="text-right font-medium tabular-nums">
                        {formatCurrency(stats.totalAmount)}
                      </td>

                      <td className="text-right tabular-nums">
                        {hasOutstanding ? (
                          <span className="font-bold text-error-600 dark:text-error-400">
                            {formatCurrency(stats.outstanding)}
                          </span>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 size={11} /> À jour
                          </Badge>
                        )}
                      </td>

                      <td className="text-right">
                        <Link
                          to={`/clients/${client.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-md transition-colors"
                        >
                          Fiche
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
