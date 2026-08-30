import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Printer,
  CalendarDays,
} from 'lucide-react';
import {
  getTripExpenses,
  getExpenseCategories,
  getParcels,
  createTripExpense,
  updateTripExpense,
  deleteTripExpense,
  createExpenseCategory,
  saveAttachmentsForEntity,
} from '../../lib/data';
import type { Attachment, TripExpense, ExpenseCategory, Parcel } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { OfflineNotice } from '../../components/ui/OfflineNotice';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { AttachmentManager } from '../../components/ui/AttachmentManager';
import { formatCurrency, formatDate, formatTrackingNumber } from '../../lib/format';
import { generateReportPDF } from '../../lib/pdf';
import { useToast } from '../../context/ToastContext';
import { SubmitLock } from '../../lib/submitLock';
import { userErrorMessage } from '../../lib/userMessage';

const DEFAULT_CATEGORY_NAMES = [
  'Douane',
  'Carburant',
  'Police',
  'Gendarmerie',
  'Péage',
  'Réparation',
  'Manutention',
  'Déchargement',
  'Chargement',
  'Parking',
  'Hébergement',
  'Nourriture',
  'Communication',
  'Divers',
];

export function ExpensesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const submitLockRef = useRef<SubmitLock | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<TripExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    parcel_id: '',
    category_id: '',
    category_name: '',
    label: '',
    amount: '' as string | number,
    expense_date: today,
    location: '',
    notes: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [expenseData, categoryData, parcelData] = await Promise.all([
          getTripExpenses(),
          getExpenseCategories(),
          getParcels(),
        ]);
        setExpenses(expenseData);
        setParcels(parcelData);
        const categoriesList = categoryData.length
          ? categoryData
          : DEFAULT_CATEGORY_NAMES.map((name) => ({
            id: name,
            name,
            created_at: today,
            updated_at: today,
          }));
        setCategories(categoriesList);
      } catch (err) {
        console.error('Failed to load expenses page data', err);
        setError('Impossible de charger les données des dépenses.');
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  useEffect(() => {
    if (categories.length > 0) {
      setForm((prev) => {
        if (prev.category_id) return prev;
        return {
          ...prev,
          category_id: categories[0].id,
          category_name: categories[0].name,
        };
      });
    }
  }, [categories, today]);

  const parcelMap = useMemo(
    () => new Map(parcels.map((parcel) => [parcel.id, parcel])),
    [parcels]
  );

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const parcel = parcelMap.get(expense.parcel_id);
      const matchesSearch =
        !normalizedSearch ||
        expense.label.toLowerCase().includes(normalizedSearch) ||
        expense.category_name.toLowerCase().includes(normalizedSearch) ||
        expense.location.toLowerCase().includes(normalizedSearch) ||
        expense.notes.toLowerCase().includes(normalizedSearch) ||
        expense.expense_date.includes(normalizedSearch) ||
        parcel?.tracking_number?.toLowerCase().includes(normalizedSearch) ||
        parcel?.vehicle?.toLowerCase().includes(normalizedSearch) ||
        parcel?.agent_name?.toLowerCase().includes(normalizedSearch);

      const matchesCategory = categoryFilter === 'all' || expense.category_name === categoryFilter;
      const matchesFrom = !fromDate || expense.expense_date >= fromDate;
      const matchesTo = !toDate || expense.expense_date <= toDate;
      return matchesSearch && matchesCategory && matchesFrom && matchesTo;
    });
  }, [expenses, parcelMap, search, categoryFilter, fromDate, toDate]);

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const spendCount = filteredExpenses.length;
  const tripsCount = new Set(filteredExpenses.map((expense) => expense.parcel_id)).size;

  const totalsByCategory = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category_name] = (acc[expense.category_name] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryTotals = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  const monthlyTotals = filteredExpenses.reduce((acc, expense) => {
    const month = expense.expense_date.slice(0, 7);
    acc[month] = (acc[month] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const openNewExpense = () => {
    setSelectedExpense(null);
    setAttachments([]);
    setForm({
      parcel_id: '',
      category_id: categories[0]?.id || '',
      category_name: categories[0]?.name || '',
      label: '',
      amount: '',
      expense_date: today,
      location: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditExpense = (expense: TripExpense) => {
    setSelectedExpense(expense);
    setAttachments([]);
    setForm({
      parcel_id: expense.parcel_id,
      category_id: expense.category_id || '',
      category_name: expense.category_name,
      label: expense.label,
      amount: expense.amount,
      expense_date: expense.expense_date,
      location: expense.location,
      notes: expense.notes,
    });
    setShowModal(true);
  };

  const handleSaveCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const category = await createExpenseCategory({ name });
      setCategories((prev) => [category, ...prev]);
      setForm((prev) => ({ ...prev, category_id: category.id, category_name: category.name }));
      setNewCategoryName('');
    } catch (error) {
      console.error('Erreur de création de catégorie', error);
      addToast({
        type: 'error',
        title: 'Erreur',
        description: userErrorMessage(error, 'Impossible de créer la catégorie.'),
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.parcel_id || !form.category_name || !form.label || Number(form.amount) <= 0) return;
    if (!submitLockRef.current) submitLockRef.current = new SubmitLock();
    if (!submitLockRef.current.acquire()) return;
    setSaving(true);

    try {
      const category = categories.find((cat) => cat.id === form.category_id);
      const selectedParcel = parcelMap.get(form.parcel_id);
      const payload = {
        parcel_id: form.parcel_id,
        trip_id: selectedParcel?.trip_id,
        trip_vehicle_id: selectedParcel?.trip_vehicle_id,
        category_id: category?.id,
        category_name: category?.name || form.category_name,
        label: form.label,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        location: form.location,
        notes: form.notes,
        created_by: user?.id || '',
        created_by_name: user?.full_name || '',
      };

      if (selectedExpense) {
        const updated = await updateTripExpense(selectedExpense.id, payload);
        if (updated) {
          await saveAttachmentsForEntity('expense', selectedExpense.id, attachments);
          setExpenses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          setShowModal(false);
        }
      } else {
        const created = await createTripExpense(payload);
        if (created) {
          if (attachments.length > 0) {
            await saveAttachmentsForEntity('expense', created.id, attachments);
          }
          setExpenses((prev) => [created, ...prev]);
          setShowModal(false);
        }
      }
    } catch (error) {
      console.error('Erreur d’enregistrement de la dépense', error);
      addToast({
        type: 'error',
        title: 'Erreur d’enregistrement',
        description: userErrorMessage(error, 'Impossible d’enregistrer la dépense. Réessayez.'),
      });
    } finally {
      setSaving(false);
      submitLockRef.current.release();
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    try {
      await deleteTripExpense(selectedExpense.id);
      setExpenses((prev) => prev.filter((item) => item.id !== selectedExpense.id));
      setShowDelete(false);
      setShowModal(false);
    } catch (error) {
      console.error('Erreur de suppression de la dépense', error);
      addToast({
        type: 'error',
        title: 'Erreur de suppression',
        description: userErrorMessage(error, 'Impossible de supprimer la dépense.'),
      });
    }
  };

  const handlePrint = () => {
    const rows = filteredExpenses.map((expense) => [
      formatDate(expense.expense_date),
      expense.category_name,
      expense.label,
      expense.location,
      formatCurrency(expense.amount),
      expense.notes || '—',
    ]);
    generateReportPDF(
      'Rapport des dépenses',
      ['Date', 'Catégorie', 'Libellé', 'Lieu', 'Montant', 'Observation'],
      rows,
      `Total dépenses : ${formatCurrency(totalAmount)}`
    );
  };

  return (
    <div className="space-y-6">
      <OfflineNotice />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Dépenses
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Dépenses
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Suivi des dépenses et rapports.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="secondary" size="sm" onClick={handlePrint} className="w-full sm:w-auto">
            <Printer size={16} /> Imprimer
          </Button>
          <Button size="sm" onClick={openNewExpense} className="w-full sm:w-auto">
            <Plus size={16} /> Nouvelle dépense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Total dépensé</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-3">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Nombre de dépenses</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-3">{spendCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Nombre de colis concernés</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-3">{tripsCount}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <Input
            placeholder="Rechercher colis, catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={18} />}
          />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="lg:col-span-1">
            <option value="all">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </Select>
          <Input
            label="Date début"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            label="Date fin"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </Card>

      {error ? (
        <Card className="p-5 text-center">
          <p className="text-sm text-error-600 dark:text-error-300">{error}</p>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Dépenses récentes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Liste des dépenses enregistrées.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <CalendarDays size={16} />
              {Object.entries(monthlyTotals).slice(0, 3).map(([month, amount]) => (
                <span key={month} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">{month}: {formatCurrency(amount)}</span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/40 animate-pulse" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucune dépense ne correspond aux critères.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[1080px] gap-3">
                <div className="grid grid-cols-12 gap-3 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 py-3">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Catégorie</div>
                  <div className="col-span-2">Libellé</div>
                  <div className="col-span-1">Lieu</div>
                  <div className="col-span-2 text-right">Montant</div>
                  <div className="col-span-1">Observation</div>
                  <div className="sticky right-0 z-10 col-span-2 text-right bg-white dark:bg-slate-900">Actions</div>
                </div>
                {filteredExpenses.map((expense) => (
                  <div key={expense.id} className="grid grid-cols-12 gap-3 items-center py-4 border-b border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                    <div className="col-span-2">{formatDate(expense.expense_date)}</div>
                    <div className="col-span-2 font-medium">{expense.category_name}</div>
                    <div className="col-span-2 truncate">{expense.label}</div>
                    <div className="col-span-1 truncate">{expense.location}</div>
                    <div className="col-span-2 text-right font-semibold tabular-nums">{formatCurrency(expense.amount)}</div>
                    <div className="col-span-1 truncate">{expense.notes || '—'}</div>
                    <div className="sticky right-0 z-10 col-span-2 text-right space-x-1 bg-white dark:bg-slate-900">
                      <Link to={`/expenses/trip/${expense.parcel_id}`} className="btn-secondary btn-sm px-2.5 py-2.5" aria-label={`Voir le détail de la dépense ${expense.label || ''}`}>Détail</Link>
                      <button type="button" onClick={() => openEditExpense(expense)} aria-label="Modifier la dépense" className="btn-secondary btn-sm px-2.5 py-2.5">
                        <Edit2 size={14} />
                      </button>
                      <button type="button" onClick={() => { setSelectedExpense(expense); setShowDelete(true); }} aria-label="Supprimer la dépense" className="btn-danger btn-sm px-2.5 py-2.5">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Total par catégorie</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryTotals.slice(0, 9).map(([name, amount]) => (
            <div key={name} className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{name}</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{formatCurrency(amount)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Select
              label="Colis"
              value={form.parcel_id}
              onChange={(e) => setForm({ ...form, parcel_id: e.target.value })}
              required
            >
              <option value="">— Sélectionner un colis —</option>
              {parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {formatTrackingNumber(parcel.tracking_number)} · {parcel.vehicle || parcel.agent_name || parcel.origin} → {parcel.destination}
                </option>
              ))}
            </Select>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="label">Catégorie</label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nouvelle catégorie"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button variant="secondary" type="button" onClick={handleSaveCategory}>
                    Ajouter
                  </Button>
                </div>
              </div>
              <Select
                value={form.category_id}
                onChange={(e) => {
                  const category = categories.find((category) => category.id === e.target.value);
                  setForm({
                    ...form,
                    category_id: e.target.value,
                    category_name: category?.name || '',
                  });
                }}
                required
                className="w-full"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              label="Libellé"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Input
              label="Montant"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? '' : Number(e.target.value) })}
              required
            />
            <Input
              label="Date"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              required
            />
            <Input
              label="Lieu"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <Textarea
            label="Observation"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Pièces jointes</h3>
            <AttachmentManager
              entityType="expense"
              entityId={selectedExpense?.id}
              initialAttachments={attachments}
              onChange={setAttachments}
            />
          </div>

          <div className="flex justify-between gap-3 pt-4">
            {selectedExpense ? (
              <Button variant="danger" type="button" onClick={() => setShowDelete(true)}>
                Supprimer
              </Button>
            ) : <div />}
            <div className="flex items-center gap-3">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={saving}>
                {selectedExpense ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer la dépense"
        message="Voulez-vous supprimer cette dépense ?"
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
