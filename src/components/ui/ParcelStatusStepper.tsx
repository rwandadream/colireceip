import { Check, Package, Truck, MapPin, PackageCheck } from 'lucide-react';
import type { ParcelStatus } from '../../lib/types';

interface Step {
  status: ParcelStatus;
  label: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  { status: 'received', label: 'Reçu', icon: <Package size={14} /> },
  { status: 'in_transit', label: 'En route', icon: <Truck size={14} /> },
  { status: 'arrived', label: 'Arrivé', icon: <MapPin size={14} /> },
  { status: 'delivered', label: 'Livré', icon: <PackageCheck size={14} /> },
];

const STEP_INDEX: Record<string, number> = {
  received: 0,
  in_transit: 1,
  arrived: 2,
  delivered: 3,
};

export function ParcelStatusStepper({ status }: { status: ParcelStatus }) {
  const currentIndex = STEP_INDEX[status] ?? -1;

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3">
      <ol className="flex items-start">
        {STEPS.map((step, index) => {
          const completed = currentIndex >= 0 && index < currentIndex;
          const current = index === currentIndex;
          const isLast = index === STEPS.length - 1;
          return (
            <li key={step.status} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
              <div className="flex items-start w-full">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={[
                      'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                      completed
                        ? 'bg-emerald-500 text-white'
                        : current
                        ? 'bg-brand-600 text-white ring-2 ring-brand-600/25'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                    ].join(' ')}
                  >
                    {completed ? <Check size={14} /> : step.icon}
                  </div>
                  <span
                    className={[
                      'mt-1 text-[10px] sm:text-xs font-medium whitespace-nowrap',
                      current
                        ? 'text-brand-600 dark:text-brand-400'
                        : completed
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-500',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 h-0.5 mt-3.5 mx-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-full transition-all ${currentIndex > index ? 'bg-emerald-500' : 'bg-transparent'}`}
                      style={{ width: currentIndex > index ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
