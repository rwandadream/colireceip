import { useState, useEffect, useMemo } from 'react';
import { ScrollText, Search, AlertTriangle } from 'lucide-react';
import { getActivityLogs, getUsers } from '../lib/data';
import type { ActivityLog, User } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { OfflineNotice } from '../components/ui/OfflineNotice';
import { EmptyState, Skeleton } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { formatDateTime, timeAgo } from '../lib/format';

export function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [l, u] = await Promise.all([getActivityLogs(), getUsers()]);
        if (!active) return;
        setLogs(l);
        setUsers(u);
      } catch (error) {
        console.error('Chargement du journal échoué', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch =
        !search ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.details?.toLowerCase().includes(search.toLowerCase());
      const matchesUser = userFilter === 'all' || l.user_id === userFilter;
      return matchesSearch && matchesUser;
    });
  }, [logs, search, userFilter]);

  return (
    <div className="space-y-4">
      <OfflineNotice />
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Journal des Actions & Audit
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {logs.length} activités et événements système enregistrés
        </p>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par action, agent, détail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="sm:w-48"
          >
            <option value="all">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Data Table */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : loadError ? (
        <Card className="p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-1">Impossible de charger le journal</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Une erreur est survenue lors du chargement des données.</p>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Réessayer</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<ScrollText size={32} />} title="Aucune action trouvée" />
        </Card>
      ) : (
        <div className="data-table-container">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      <span>{formatDateTime(log.created_at)}</span>
                      <span className="text-[11px] text-slate-400 block font-normal">
                        ({timeAgo(log.created_at)})
                      </span>
                    </td>

                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {log.user_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {log.user_name}
                        </span>
                      </div>
                    </td>

                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {log.action}
                    </td>

                    <td className="text-xs text-slate-500 dark:text-slate-400">
                      {log.details ? (
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {log.details}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
