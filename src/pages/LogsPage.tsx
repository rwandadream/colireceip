import { useState, useEffect, useMemo } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { getActivityLogs, getUsers } from '../lib/data';
import type { ActivityLog, User } from '../lib/types';
import { Card } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { formatDateTime, timeAgo } from '../lib/format';

export function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    let active = true;

    (async () => {
      const [l, u] = await Promise.all([getActivityLogs(), getUsers()]);
      if (!active) return;
      setLogs(l);
      setUsers(u);
      setLoading(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Journal des actions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{logs.length} actions enregistrées</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Rechercher une action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="sm:w-48">
            <option value="all">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<ScrollText size={32} />} title="Aucune action trouvée" />
        </Card>
      ) : (
        <Card className="p-2">
          <div className="space-y-1">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-semibold flex-shrink-0">
                  {log.user_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-medium">{log.user_name}</span>{' '}
                    <span>{log.action}</span>
                  </p>
                  {log.details && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.details}</p>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {formatDateTime(log.created_at)} · {timeAgo(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
