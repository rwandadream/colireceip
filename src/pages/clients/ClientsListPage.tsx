import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Phone, MessageCircle, MapPin } from 'lucide-react';
import { getClients, getParcels } from '../../lib/data';
import type { Client, Parcel } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader } from '../../components/ui/PageHeader';

export function ClientsListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([getClients(), getParcels()]);
      setClients(c);
      setParcels(p);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter(
      (c) =>
        !search ||
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.city?.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  const getClientStats = (clientId: string) => {
    const clientParcels = parcels.filter((p) => p.client_id === clientId);
    const totalAmount = clientParcels.reduce((sum, p) => sum + p.total_amount, 0);
    return { count: clientParcels.length, totalAmount };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${clients.length} clients enregistrés`}
        actions={
          <Link to="/clients/new" className="btn-primary w-full sm:w-auto">
            <Plus size={18} />
            Nouveau client
          </Link>
        }
      />

      <Card className="p-4">
        <Input
          placeholder="Rechercher par nom, téléphone, ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={18} />}
        />
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
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
                    {client.whatsapp && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <MessageCircle size={14} className="text-slate-400" />
                        <span>{client.whatsapp}</span>
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
