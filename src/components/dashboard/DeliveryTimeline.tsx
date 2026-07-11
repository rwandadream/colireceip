import { motion } from 'framer-motion';

const steps = [
  { key: 'ordered', label: 'Commandé' },
  { key: 'prepared', label: 'Préparation' },
  { key: 'in_transit', label: 'En transit' },
  { key: 'arrived', label: 'Arrivé' },
  { key: 'delivered', label: 'Livré' },
];

export function DeliveryTimeline({ current = 2 }: { current?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Timeline de livraison</h3>
          <p className="mt-1 text-sm text-slate-400">Étapes clés du cycle de livraison.</p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">Analyse</span>
      </div>

      <div className="mt-6 space-y-5">
        {steps.map((step, index) => {
          const active = index <= current;
          return (
            <div key={step.key} className="flex items-center gap-4">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-3xl border border-white/10 bg-slate-950/80 text-white">
                <span className={active ? 'bg-accent-500 text-white' : 'bg-slate-900 text-slate-400'} style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 18 }}>
                  {index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span className="absolute right-[-18px] top-1/2 h-0.5 w-10 -translate-y-1/2 bg-white/10"></span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-1 text-xs text-slate-500">{active ? 'Complété' : 'A venir'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${active ? 'bg-accent-500/15 text-accent-200' : 'bg-white/5 text-slate-400'}`}>
                {active ? 'Terminé' : 'En attente'}
              </span>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
