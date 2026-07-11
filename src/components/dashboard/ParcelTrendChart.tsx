import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { Card } from '../../components/ui/Card';
import type { Parcel } from '../../lib/types';
import { formatCurrency } from '../../lib/format';

interface ParcelTrendChartProps {
  parcels: Parcel[];
}

function buildTrendData(parcels: Parcel[]) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, label: format(date, 'EEE', { locale: undefined }), parcels: 0, revenue: 0 };
  });

  parcels.forEach((parcel) => {
    const created = parseISO(parcel.created_at);
    const match = days.find((day) => format(day.date, 'yyyy-MM-dd') === format(created, 'yyyy-MM-dd'));
    if (match) {
      match.parcels += 1;
      match.revenue += parcel.total_amount;
    }
  });

  return days.map((item) => ({
    day: item.label,
    parcels: item.parcels,
    revenue: Number((item.revenue / 1000).toFixed(2)),
  }));
}

export function ParcelTrendChart({ parcels }: ParcelTrendChartProps) {
  const data = buildTrendData(parcels);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Tendance des livraisons</h3>
          <p className="mt-1 text-sm text-slate-400">Volume des colis et revenus sur la dernière semaine.</p>
        </div>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorParcels" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F97316" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#F97316" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#94A3B8" />
            <YAxis axisLine={false} tickLine={false} stroke="#94A3B8" width={42} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 16,
                color: '#fff',
              }}
              formatter={(value: number, name: string) => [name === 'revenue' ? formatCurrency(value * 1000) : value, name === 'revenue' ? 'Revenus' : 'Colis']}
            />
            <Legend wrapperStyle={{ color: '#94A3B8', paddingTop: 10 }} />
            <Area type="monotone" dataKey="parcels" name="Colis" stroke="#2563EB" fill="url(#colorParcels)" strokeWidth={3} />
            <Area type="monotone" dataKey="revenue" name="Revenus (K)" stroke="#F97316" fill="url(#colorRevenue)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
