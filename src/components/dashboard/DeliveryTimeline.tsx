import { motion } from 'framer-motion';

const steps = [
  { key: 'ordered', label: 'Commandé', color: 'bg-slate-200 text-slate-700' },
  { key: 'prepared', label: 'Préparation', color: 'bg-accent-100 text-accent-700' },
  { key: 'in_transit', label: 'En transit', color: 'bg-brand-100 text-brand-700' },
  { key: 'arrived', label: 'Arrivé', color: 'bg-yellow-100 text-warning-700' },
  { key: 'delivered', label: 'Livré', color: 'bg-success-100 text-success-700' },
];

export function DeliveryTimeline({ current = 2 }: { current?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Timeline de livraison</h3>
        <div className="text-xs text-slate-400">Statut en direct</div>
      </div>

      <div className="flex items-center gap-2 w-full">
        {steps.map((s, i) => (
          <div key={s.key} className="flex-1 flex items-center">
            <div className="flex items-center flex-col w-full">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i <= current ? 'ring-4 ring-brand-200' : 'bg-white'} ${i <= current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <span className="text-sm font-semibold">{i + 1}</span>
              </div>
              <div className="mt-2 text-xs text-center">{s.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-1 flex-1 ${i < current ? 'bg-brand-500' : 'bg-slate-200'}`} style={{ margin: '0 8px' }} />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
