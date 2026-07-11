import { motion } from 'framer-motion';
import { Users, DollarSign } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { Parcel } from '../../lib/types';
import { formatCurrency } from '../../lib/format';

interface TopAgentsCardProps {
  parcels: Parcel[];
}

interface AgentMetric {
  name: string;
  count: number;
  revenue: number;
}

export function TopAgentsCard({ parcels }: TopAgentsCardProps) {
  const agents = parcels.reduce<Record<string, AgentMetric>>((acc, parcel) => {
    const name = parcel.registered_by_name || 'Équipe locale';
    if (!acc[name]) {
      acc[name] = { name, count: 0, revenue: 0 };
    }
    acc[name].count += 1;
    acc[name].revenue += parcel.total_amount;
    return acc;
  }, {});

  const topAgents = Object.values(agents)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const maxCount = Math.max(...topAgents.map((agent) => agent.count), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">Top agents</h3>
            <p className="mt-1 text-sm text-slate-400">Performances des agents de saisie.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
            <Users size={14} /> Agents
          </div>
        </div>

        <div className="space-y-4">
          {topAgents.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center text-sm text-slate-400">
              Aucune activité d’agent disponible.
            </div>
          ) : (
            topAgents.map((agent) => {
              const progress = Math.max(6, Math.round((agent.count / maxCount) * 100));
              return (
                <div key={agent.name} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-brand-500/15 text-brand-300 font-semibold">
                        {agent.name
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{agent.name}</p>
                        <p className="text-sm text-slate-400">{agent.count} colis</p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      <DollarSign size={12} /> {formatCurrency(agent.revenue)}
                    </div>
                  </div>
                  <div className="rounded-full bg-white/5 h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full bg-accent-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </motion.section>
  );
}
