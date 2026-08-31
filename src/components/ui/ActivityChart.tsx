import { useMemo } from 'react';
import { Card } from './Card';

export type ChartRange = 7 | 14 | 30;

interface ActivityChartProps {
  parcels: { id: string; created_at: string }[];
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
}

export function ActivityChart({ parcels, range, onRangeChange }: ActivityChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Array.from({ length: range }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (range - 1 - i));
      return d;
    });

    const counts = new Array(range).fill(0);
    for (const p of parcels) {
      const created = new Date(p.created_at);
      created.setHours(0, 0, 0, 0);
      const idx = days.findIndex((d) => d.getTime() === created.getTime());
      if (idx >= 0) counts[idx] += 1;
    }
    return { days, counts, max: Math.max(1, ...counts) };
  }, [parcels, range]);

  const total = data.counts.reduce((a, b) => a + b, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Activité des colis</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Colis enregistrés · <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span> au total
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          {([7, 14, 30] as ChartRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                range === r
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {r} j
            </button>
          ))}
        </div>
      </div>

      <div className="w-full" style={{ height: 180 }}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
          {data.counts.map((count, i) => {
            const h = (count / data.max) * 100;
            const x = (i / range) * 100 + 100 / range / 2;
            return (
              <rect
                key={i}
                x={x - 100 / range / 2 + 1}
                y={40 - (h / 100) * 38 - 2}
                width={100 / range - 2}
                height={(h / 100) * 38}
                rx={1}
                fill="url(#chart-grad)"
                opacity={count > 0 ? 1 : 0.06}
              />
            );
          })}
          <defs>
            <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-2">
        <span>{data.days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        <span>{data.days[data.days.length - 1].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
      </div>
    </Card>
  );
}
