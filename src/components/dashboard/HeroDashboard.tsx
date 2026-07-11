import { motion } from 'framer-motion';
import { Plus, Sparkles, Truck, ShieldCheck, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardStats } from '../../lib/types';
import { formatCurrency } from '../../lib/format';

interface HeroDashboardProps {
  stats: DashboardStats;
}

export function HeroDashboard({ stats }: HeroDashboardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-[28px] bg-gradient-to-br from-brand-700 via-[#122144] to-[#131a2b] p-6 lg:p-8 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.85)] overflow-hidden"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-200">
            <Sparkles size={14} /> Opérations miroir
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white">Pipeline logistique haut de gamme</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Suivez les livraisons, contrôlez les paiements et supervisez l’activité en temps réel sur une interface sombre, raffinée et rapide.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-[24px] bg-white/5 border border-white/10 p-4">
              <div className="text-sm text-slate-300">Livraisons en transit</div>
              <div className="mt-2 text-3xl font-semibold text-white">{stats.in_transit}</div>
            </div>
            <div className="rounded-[24px] bg-white/5 border border-white/10 p-4">
              <div className="text-sm text-slate-300">Montant encaissé aujourd’hui</div>
              <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(stats.collected_today)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Link to="/parcels/new" className="btn btn-accent">
              <Plus size={16} />
              Nouveau colis
            </Link>
            <button type="button" className="btn btn-ghost text-white border border-white/10 px-4 py-3">
              <Truck size={16} />
              Voir les expéditions
            </button>
          </div>
        </div>

        <div className="rounded-[28px] bg-slate-950/40 border border-white/10 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm uppercase tracking-[0.24em] text-slate-400">Performance</h3>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.delivered} colis livrés</p>
            </div>
            <div className="grid place-items-center h-14 w-14 rounded-3xl bg-brand-500/20 text-brand-200">
              <ShieldCheck size={24} />
            </div>
          </div>
          <div className="mt-6 space-y-4 text-slate-300">
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-brand-500/15 text-brand-300">
                  <Truck size={18} />
                </span>
                <div>
                  <p className="text-sm text-slate-300">Colis prêts à partir</p>
                  <p className="text-lg font-semibold text-white">{stats.pending}</p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">En attente</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-accent-500/15 text-accent-300">
                  <Clock size={18} />
                </span>
                <div>
                  <p className="text-sm text-slate-300">Nouveaux colis aujourd’hui</p>
                  <p className="text-lg font-semibold text-white">{stats.received_today}</p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">Live</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
