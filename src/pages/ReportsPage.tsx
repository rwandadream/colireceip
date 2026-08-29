import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  CreditCard,
  Users,
  UserCog,
  FileSpreadsheet,
  FileDown,
  CalendarRange,
  RotateCcw,
} from 'lucide-react';
import {
  getParcels,
  getPayments,
  getClients,
  getActivityLogs,
} from '../lib/data';
import type { Parcel, Payment, Client, ActivityLog } from '../lib/types';
import { PARCEL_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../lib/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatCurrency, formatDate, formatDateTime, formatTrackingNumber } from '../lib/format';
import { generateReportPDF } from '../lib/pdf';
import * as XLSX from 'xlsx';

type ReportType = 'all_parcels' | 'delivered' | 'pending' | 'payments' | 'clients' | 'agent_activity';

export function ReportsPage() {
  const [rawParcels, setRawParcels] = useState<Parcel[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [rawClients, setRawClients] = useState<Client[]>([]);
  const [rawLogs, setRawLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const [p, pays, c, l] = await Promise.all([
          getParcels(),
          getPayments(),
          getClients(),
          getActivityLogs(),
        ]);
        setRawParcels(p);
        setRawPayments(pays);
        setRawClients(c);
        setRawLogs(l);
      } catch (error) {
        console.error('Chargement des rapports échoué', error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawParcels) if (p.registered_by_name) set.add(p.registered_by_name);
    for (const p of rawPayments) if (p.recorded_by_name) set.add(p.recorded_by_name);
    for (const l of rawLogs) if (l.user_name) set.add(l.user_name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rawParcels, rawPayments, rawLogs]);

  const inRange = useCallback((dateStr: string | null): boolean => {
    if (!dateStr) return true;
    const t = new Date(dateStr).getTime();
    if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
    return true;
  }, [from, to]);

  const parcels = useMemo(
    () => rawParcels.filter((p) => (statusFilter === 'all' || p.status === statusFilter) && (agentFilter === 'all' || p.registered_by_name === agentFilter) && inRange(p.received_date)),
    [rawParcels, statusFilter, agentFilter, inRange]
  );

  const payments = useMemo(
    () => rawPayments.filter((p) => (agentFilter === 'all' || p.recorded_by_name === agentFilter) && inRange(p.payment_date)),
    [rawPayments, agentFilter, inRange]
  );

  const clients = useMemo(
    () => rawClients.filter((c) => inRange(c.created_at)),
    [rawClients, inRange]
  );

  const logs = useMemo(
    () => rawLogs.filter((l) => (agentFilter === 'all' || l.user_name === agentFilter) && inRange(l.created_at)),
    [rawLogs, agentFilter, inRange]
  );

  const totals = useMemo(
    () => {
      const paymentsByParcel = new Map<string, number>();
      for (const payment of payments) {
        paymentsByParcel.set(payment.parcel_id, (paymentsByParcel.get(payment.parcel_id) || 0) + payment.amount);
      }
      // "Payé au départ" parcels carry an origin amount with no payment row;
      // contribute max(amount_paid - payments, 0) so it is never double-counted
      // nor silently dropped when runtime payments exist.
      const originCollected = parcels
        .filter((p) => p.payment_condition === 'paid_origin' && (p.amount_paid || 0) > 0)
        .reduce((sum, p) => sum + Math.max((p.amount_paid || 0) - (paymentsByParcel.get(p.id) || 0), 0), 0);
      return {
        value: parcels.reduce((sum, p) => sum + (p.total_amount || 0), 0),
        collected: payments.reduce((sum, p) => sum + p.amount, 0) + originCollected,
        outstanding: parcels.reduce((sum, p) => sum + (p.balance || 0), 0),
      };
    },
    [parcels, payments]
  );

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setStatusFilter('all');
    setAgentFilter('all');
  };

  const hasFilters = Boolean(from || to || statusFilter !== 'all' || agentFilter !== 'all');

  const exportPDF = (type: ReportType) => {
    const now = formatDate(new Date(), "dd/MM/yyyy à HH:mm");
    switch (type) {
      case 'all_parcels':
        generateReportPDF(
          'Tous les colis',
          ['N° Colis', 'Client', 'Téléphone', 'Statut', 'Total', 'Payé', 'Reste', 'Date'],
          parcels.map((p) => [
            formatTrackingNumber(p.tracking_number),
            p.client_name,
            p.client_phone || '—',
            PARCEL_STATUS_LABELS[p.status],
            formatCurrency(p.total_amount),
            formatCurrency(p.amount_paid),
            formatCurrency(p.balance),
            formatDate(p.received_date),
          ]),
          `${parcels.length} colis · Généré le ${now}`
        );
        break;
      case 'delivered': {
        const delivered = parcels.filter((p) => p.status === 'delivered');
        generateReportPDF(
          'Colis livrés',
          ['N° Colis', 'Client', 'Téléphone', 'Total', 'Payé', 'Date livraison'],
          delivered.map((p) => [
            formatTrackingNumber(p.tracking_number),
            p.client_name,
            p.client_phone || '—',
            formatCurrency(p.total_amount),
            formatCurrency(p.amount_paid),
            formatDate(p.delivery_date),
          ]),
          `${delivered.length} colis livrés · Généré le ${now}`
        );
        break;
      }
      case 'pending': {
        const pending = parcels.filter((p) => p.status === 'pending' || p.status === 'received');
        generateReportPDF(
          'Colis en attente',
          ['N° Colis', 'Client', 'Téléphone', 'Statut', 'Total', 'Reste', 'Date réception'],
          pending.map((p) => [
            formatTrackingNumber(p.tracking_number),
            p.client_name,
            p.client_phone || '—',
            PARCEL_STATUS_LABELS[p.status],
            formatCurrency(p.total_amount),
            formatCurrency(p.balance),
            formatDate(p.received_date),
          ]),
          `${pending.length} colis en attente · Généré le ${now}`
        );
        break;
      }
      case 'payments':
        generateReportPDF(
          'Paiements',
          ['Date', 'Colis', 'Client', 'Montant', 'Mode', 'Agent'],
          payments.map((p) => [
            formatDateTime(p.payment_date),
            formatTrackingNumber(p.parcel_tracking),
            p.client_name,
            formatCurrency(p.amount),
            PAYMENT_METHOD_LABELS[p.payment_method],
            p.recorded_by_name,
          ]),
          `${payments.length} paiements · Total: ${formatCurrency(payments.reduce((s, p) => s + p.amount, 0))} · Généré le ${now}`
        );
        break;
      case 'clients':
        generateReportPDF(
          'Clients',
          ['Nom', 'Téléphone', 'Ville', 'Adresse', 'Date création'],
          clients.map((c) => [
            c.full_name,
            c.phone || '—',
            c.city || '—',
            c.address || '—',
            formatDate(c.created_at),
          ]),
          `${clients.length} clients · Généré le ${now}`
        );
        break;
      case 'agent_activity':
        generateReportPDF(
          'Activité des agents',
          ['Date', 'Agent', 'Action', 'Détails'],
          logs.map((l) => [
            formatDateTime(l.created_at),
            l.user_name,
            l.action,
            l.details || '—',
          ]),
          `${logs.length} actions · Généré le ${now}`
        );
        break;
    }
  };

  const exportExcel = (type: ReportType) => {
    let data: Record<string, string | number>[] = [];
    let filename = '';

    switch (type) {
      case 'all_parcels':
        data = parcels.map((p) => ({
          'N° Colis': formatTrackingNumber(p.tracking_number),
          Client: p.client_name,
          Téléphone: p.client_phone || '',
          Statut: PARCEL_STATUS_LABELS[p.status],
          Origine: p.origin,
          Destination: p.destination,
          Total: p.total_amount,
          'Montant payé': p.amount_paid,
          'Reste à payer': p.balance,
          'Date réception': formatDate(p.received_date),
          'Date livraison': formatDate(p.delivery_date),
          Agent: p.registered_by_name,
        }));
        filename = 'colis.xlsx';
        break;
      case 'delivered':
        data = parcels.filter((p) => p.status === 'delivered').map((p) => ({
          'N° Colis': formatTrackingNumber(p.tracking_number),
          Client: p.client_name,
          Téléphone: p.client_phone || '',
          Total: p.total_amount,
          'Montant payé': p.amount_paid,
          'Date livraison': formatDate(p.delivery_date),
        }));
        filename = 'colis-livres.xlsx';
        break;
      case 'pending':
        data = parcels.filter((p) => p.status === 'pending' || p.status === 'received').map((p) => ({
          'N° Colis': formatTrackingNumber(p.tracking_number),
          Client: p.client_name,
          Statut: PARCEL_STATUS_LABELS[p.status],
          Total: p.total_amount,
          'Reste à payer': p.balance,
          'Date réception': formatDate(p.received_date),
        }));
        filename = 'colis-attente.xlsx';
        break;
      case 'payments':
        data = payments.map((p) => ({
          Date: formatDateTime(p.payment_date),
          'N° Colis': formatTrackingNumber(p.parcel_tracking),
          Client: p.client_name,
          Montant: p.amount,
          'Mode de paiement': PAYMENT_METHOD_LABELS[p.payment_method],
          Agent: p.recorded_by_name,
        }));
        filename = 'paiements.xlsx';
        break;
      case 'clients':
        data = clients.map((c) => ({
          Nom: c.full_name,
          Téléphone: c.phone || '',
          Ville: c.city || '',
          Adresse: c.address || '',
          'Date création': formatDate(c.created_at),
        }));
        filename = 'clients.xlsx';
        break;
      case 'agent_activity':
        data = logs.map((l) => ({
          Date: formatDateTime(l.created_at),
          Agent: l.user_name,
          Action: l.action,
          Détails: l.details || '',
        }));
        filename = 'activite-agents.xlsx';
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, filename);
  };

  const reports = [
    {
      type: 'all_parcels' as ReportType,
      title: 'Tous les colis',
      description: 'Liste complète de tous les colis',
      icon: <Package size={24} />,
      color: 'brand',
      count: parcels.length,
    },
    {
      type: 'delivered' as ReportType,
      title: 'Colis livrés',
      description: 'Colis ayant été livrés',
      icon: <CheckCircle2 size={24} />,
      color: 'success',
      count: parcels.filter((p) => p.status === 'delivered').length,
    },
    {
      type: 'pending' as ReportType,
      title: 'Colis en attente',
      description: 'Colis reçus ou en attente',
      icon: <Clock size={24} />,
      color: 'warning',
      count: parcels.filter((p) => p.status === 'pending' || p.status === 'received').length,
    },
    {
      type: 'payments' as ReportType,
      title: 'Paiements',
      description: 'Historique de tous les paiements',
      icon: <CreditCard size={24} />,
      color: 'accent',
      count: payments.length,
    },
    {
      type: 'clients' as ReportType,
      title: 'Clients',
      description: 'Liste de tous les clients',
      icon: <Users size={24} />,
      color: 'cyan',
      count: clients.length,
    },
    {
      type: 'agent_activity' as ReportType,
      title: 'Activité des agents',
      description: 'Journal de toutes les actions',
      icon: <UserCog size={24} />,
      color: 'purple',
      count: logs.length,
    },
  ];

  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
    success: 'bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
    accent: 'bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  if (loading) return <div className="animate-pulse"><div className="skeleton h-96 rounded-xl" /></div>;

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">Rapports & exports</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Rapports & Exports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Générez et exportez vos rapports métiers en formats PDF et Excel
          </p>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-error-600 dark:text-error-400 mb-1">Impossible de charger les rapports</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Une erreur est survenue lors du chargement des données.</p>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Réessayer</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">Rapports & exports</p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Rapports & Exports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Générez et exportez vos rapports métiers en formats PDF et Excel
        </p>
      </div>

      {/* Totals respecting the active filters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Colis</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{parcels.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Valorisation colis</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{formatCurrency(totals.value)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Encaissé</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{formatCurrency(totals.collected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reste à encaisser</p>
          <p className="text-xl font-bold text-error-600 dark:text-error-400 mt-1 tabular-nums">{formatCurrency(totals.outstanding)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
            <CalendarRange size={16} className="text-slate-400" />
            Filtres
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Du</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Au</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="w-44">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Statut colis</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(PARCEL_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Agent</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="all">Tous les agents</option>
              {agents.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw size={14} /> Réinitialiser
            </Button>
          )}
        </div>
        {hasFilters && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            {parcels.length} colis · {payments.length} paiements · {logs.length} actions correspondent aux filtres actifs.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {reports.map((report) => (
          <Card key={report.type} className="p-4 flex flex-col justify-between">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[report.color]}`}>
                {report.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{report.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{report.description}</p>
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1">{report.count} enregistrements</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => exportPDF(report.type)} className="flex-1">
                <FileDown size={14} />
                PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportExcel(report.type)} className="flex-1">
                <FileSpreadsheet size={14} />
                Excel
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
