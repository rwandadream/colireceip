import { motion } from 'framer-motion';
import { Activity, Package, CreditCard, Truck, UserPlus, ArrowRight } from 'lucide-react';
import type { ActivityLog } from '../../lib/types';
import { timeAgo } from '../../lib/format';

interface RealtimeActivityCardProps {
  logs: ActivityLog[];
}

const actionMap = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized.includes('paiement')) return { icon: <CreditCard size={18} />, label: 'Paiement reçu' };
  if (normalized.includes('livré') || normalized.includes('livraison')) return { icon: <Truck size={18} />, label: 'Colis livré' };
  if (normalized.includes('client')) return { icon: <UserPlus size={18} />, label: 'Nouveau client' };
  if (normalized.includes('colis')) return { icon: <Package size={18} />, label: 'Colis enregistré' };
  return { icon: <Activity size={18} />, label: 'Statut modifié' };
};

export function RealtimeActivityCard({ logs }: RealtimeActivityCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Activité en temps réel</h3>
          <p className="mt-1 text-sm text-slate-400">Journal d’événements opérationnels récents.</p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">Live</span>
      </div>

      <div className="mt-5 space-y-4">
        {logs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center text-sm text-slate-400">
            Aucune activité récente à afficher.
          </div>
        ) : (
          logs.map((log) => {
            const activity = actionMap(log.action);
            return (
              <div key={log.id} className="flex items-start gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-accent-500/30 hover:bg-slate-900/80">
                <div className="grid h-11 w-11 place-items-center rounded-3xl bg-accent-500/10 text-accent-300">
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white"><span className="font-semibold text-white">{log.user_name}</span> {log.action.toLowerCase()}</p>
                  <p className="mt-1 text-xs text-slate-500">{timeAgo(log.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  <ArrowRight size={12} />
                  {log.entity_type || 'Entité'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.section>
  );
}
