import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Phone, MapPin } from 'lucide-react';
import { getClients, getParcels } from '../../lib/data';
import { useToast } from '../../context/ToastContext';
import type { Client, Parcel } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../lib/format';

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
        const message = err instanceof Error && err.message
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

  const getClientStats = useCallback((clientId: string) => {
    const clientParcels = parcels.filter((p) => p.client_id === clientId);
    const totalAmount = clientParcels.reduce((sum, p) => sum + p.total_amount, 0);
    const outstanding = clientParcels.reduce((sum, p) => sum + (p.status !== 'cancelled' ? p.balance : 0), 0);
    return { count: clientParcels.length, totalAmount, outstanding };
  }, [parcels]);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{clients.length} clients enregistrés</p>
        </div>
        <Link to="/clients/new" className="btn-primary w-full sm:w-auto">
          <Plus size={18} />
          Nouveau client
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par nom, téléphone, ville, adresse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'with_balance' | 'paid_up')} className="sm:w-56">
            <option value="all">Tous les clients</option>
            <option value="with_balance">Avec solde impayé</option>
            <option value="paid_up">À jour</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-semibold mb-4">{error}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Veuillez vérifier votre connexion et réessayer.
            </p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={32} />}
            title="Aucun client trouvé"
            description={search ? 'Aucun client ne correspond à votre recherche.' : 'Ajoutez votre premier client.'}
            action={
              !search ? (
                <Link to="/clients/new" className="btn-primary">
                  <Plus size={18} />
                  Nouveau client
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const stats = getClientStats(client.id);
            return (
              <Link key={client.id} to={`/clients/${client.id}`}>
                <Card hover className="p-4 h-full">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold flex-shrink-0">
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{client.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Client depuis {formatDate(client.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone size={14} className="text-slate-400" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.city && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <MapPin size={14} className="text-slate-400" />
                        <span>{client.city}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Colis</p>
                      <p className="font-bold text-slate-900 dark:text-white">{stats.count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
                      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalAmount)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
