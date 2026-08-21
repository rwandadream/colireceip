import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { getParcelById, getExpensesByParcelId } from '../../lib/data';
import type { Parcel, TripExpense } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TrackingBadge } from '../../components/ui/TrackingBadge';
import { formatCurrency, formatDate } from '../../lib/format';
import { generateTripExpensePDF } from '../../lib/pdf';

export function ExpenseTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const [parcelData, expenseData] = await Promise.all([
          getParcelById(id),
          getExpensesByParcelId(id),
        ]);
        setParcel(parcelData || null);
        setExpenses(expenseData);
      } catch (err) {
        console.error('Failed to load trip expense detail', err);
        setError('Impossible de charger le détail du voyage.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const totalAmount = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const totalsByCategory = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      acc[expense.category_name] = (acc[expense.category_name] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  if (loading) {
    return <div className="animate-pulse h-96 rounded-3xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-error-600 dark:text-error-300">{error}</p>
        <Link to="/expenses" className="btn-primary mt-4">Retour aux dépenses</Link>
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Voyage introuvable</p>
        <Link to="/expenses" className="btn-primary mt-4">Retour aux dépenses</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Détail du voyage</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
            <TrackingBadge tracking={parcel.tracking_number} size="sm" /> · {parcel.origin} → {parcel.destination}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/expenses" className="btn-secondary">Retour</Link>
          <Button variant="secondary" onClick={() => generateTripExpensePDF(parcel, expenses, totalAmount)}>
            <Printer size={16} /> Imprimer
          </Button>
        </div>
      </div>

      <Card className="p-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Informations du voyage</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex justify-between items-center">
              <span>Numéro du voyage</span>
              <TrackingBadge tracking={parcel.tracking_number} size="sm" />
            </div>
            <div className="flex justify-between">
              <span>Camion</span>
              <span className="font-semibold">{parcel.vehicle || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Chauffeur</span>
              <span className="font-semibold">{parcel.agent_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Date départ</span>
              <span className="font-semibold">{formatDate(parcel.received_date)}</span>
            </div>
            <div className="flex justify-between">
              <span>Date arrivée</span>
              <span className="font-semibold">{parcel.delivery_date ? formatDate(parcel.delivery_date) : '—'}</span>
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Agence</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex justify-between">
              <span>Agence départ</span>
              <span className="font-semibold">{parcel.departure_branch || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Agence arrivée</span>
              <span className="font-semibold">{parcel.arrival_branch || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Origine</span>
              <span className="font-semibold">{parcel.origin || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Destination</span>
              <span className="font-semibold">{parcel.destination || '—'}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Dépenses</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{expenses.length} dépenses · Total {formatCurrency(totalAmount)}</p>
          </div>
          <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">{expenses.length} lignes</Badge>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400">Aucune dépense enregistrée pour ce voyage.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-12 gap-3 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Catégorie</div>
                <div className="col-span-3">Libellé</div>
                <div className="col-span-2">Lieu</div>
                <div className="col-span-1 text-right">Montant</div>
                <div className="col-span-2">Observation</div>
              </div>
              {expenses.map((expense) => (
                <div key={expense.id} className="grid grid-cols-12 gap-3 py-3 border-b border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                  <div className="col-span-2">{formatDate(expense.expense_date)}</div>
                  <div className="col-span-2 font-medium">{expense.category_name}</div>
                  <div className="col-span-3 truncate">{expense.label}</div>
                  <div className="col-span-2 truncate">{expense.location}</div>
                  <div className="col-span-1 text-right font-semibold">{formatCurrency(expense.amount)}</div>
                  <div className="col-span-2 truncate">{expense.notes || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Total par catégorie</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(totalsByCategory).map(([category, amount]) => (
            <div key={category} className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{category}</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{formatCurrency(amount)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
