import { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  CreditCard,
  Users,
  UserCog,
  FileSpreadsheet,
  FileDown,
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
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { generateReportPDF } from '../lib/pdf';
import * as XLSX from 'xlsx';

type ReportType = 'all_parcels' | 'delivered' | 'pending' | 'payments' | 'clients' | 'agent_activity';

export function ReportsPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, pays, c, l] = await Promise.all([
        getParcels(),
        getPayments(),
        getClients(),
        getActivityLogs(),
      ]);
      setParcels(p);
      setPayments(pays);
      setClients(c);
      setLogs(l);
      setLoading(false);
    })();
  }, []);

  const exportPDF = (type: ReportType) => {
    const now = formatDate(new Date(), "dd/MM/yyyy à HH:mm");
    switch (type) {
      case 'all_parcels':
        generateReportPDF(
          'Tous les colis',
          ['N° Colis', 'Client', 'Téléphone', 'Statut', 'Total', 'Payé', 'Reste', 'Date'],
          parcels.map((p) => [
            p.tracking_number,
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
      case 'delivered':
        const delivered = parcels.filter((p) => p.status === 'delivered');
        generateReportPDF(
          'Colis livrés',
          ['N° Colis', 'Client', 'Téléphone', 'Total', 'Payé', 'Date livraison'],
          delivered.map((p) => [
            p.tracking_number,
            p.client_name,
            p.client_phone || '—',
            formatCurrency(p.total_amount),
            formatCurrency(p.amount_paid),
            formatDate(p.delivery_date),
          ]),
          `${delivered.length} colis livrés · Généré le ${now}`
        );
        break;
      case 'pending':
        const pending = parcels.filter((p) => p.status === 'pending' || p.status === 'received');
        generateReportPDF(
          'Colis en attente',
          ['N° Colis', 'Client', 'Téléphone', 'Statut', 'Total', 'Reste', 'Date réception'],
          pending.map((p) => [
            p.tracking_number,
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
      case 'payments':
        generateReportPDF(
          'Paiements',
          ['Date', 'Colis', 'Client', 'Montant', 'Mode', 'Agent'],
          payments.map((p) => [
            formatDateTime(p.payment_date),
            p.parcel_tracking,
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
          ['Nom', 'Téléphone', 'WhatsApp', 'Ville', 'Adresse', 'Date création'],
          clients.map((c) => [
            c.full_name,
            c.phone || '—',
            c.whatsapp || '—',
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
    let data: Record<string, any>[] = [];
    let filename = '';

    switch (type) {
      case 'all_parcels':
        data = parcels.map((p) => ({
          'N° Colis': p.tracking_number,
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
          'N° Colis': p.tracking_number,
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
          'N° Colis': p.tracking_number,
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
          'N° Colis': p.parcel_tracking,
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
          WhatsApp: c.whatsapp || '',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Générez et exportez des rapports en PDF ou Excel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.type} className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[report.color]}`}>
                {report.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white">{report.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{report.description}</p>
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1">{report.count} enregistrements</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => exportPDF(report.type)} className="flex-1">
                <FileDown size={16} />
                PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportExcel(report.type)} className="flex-1">
                <FileSpreadsheet size={16} />
                Excel
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
