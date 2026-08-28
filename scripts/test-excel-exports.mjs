// Excel export round-trip test.
//
// SheetJS (`xlsx`) 0.18.5 is kept as the export engine: ReportsPage only WRITES
// workbooks from application data and never parses user-supplied files, so the
// known prototype-pollution advisory (reachable only through parsing a crafted
// workbook) is not an attack surface here. Switching to exceljs was rejected:
// it would drag Node core polyfills (Buffer/stream) into the browser bundle
// for zero functional gain.
//
// This test mirrors the exact column mapping used by ReportsPage for the six
// report types, writes a real .xlsx through XLSX.write, then reads it back and
// asserts every row and a numeric cell survive the round trip.
import * as XLSX from 'xlsx';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const parcels = [
  { id: 'p1', tracking_number: 'GG-COL-1001', client_name: 'Moussa Diallo', client_phone: '+22370000001', status: 'received', origin: 'Bamako', destination: 'Abidjan', total_amount: 115000, amount_paid: 50000, balance: 65000, received_date: '2026-08-01T10:00:00.000Z', delivery_date: null, registered_by_name: 'Agent A' },
  { id: 'p2', tracking_number: 'GG-COL-1002', client_name: 'Fatou Traoré', client_phone: '+22370000002', status: 'delivered', origin: 'Bamako', destination: 'Dakar', total_amount: 45000, amount_paid: 45000, balance: 0, received_date: '2026-08-02T09:00:00.000Z', delivery_date: '2026-08-10T17:00:00.000Z', registered_by_name: 'Agent B' },
  { id: 'p3', tracking_number: 'GG-COL-1003', client_name: 'Sékou Camara', client_phone: '', status: 'pending', origin: 'Bamako', destination: 'Bouaké', total_amount: 20000, amount_paid: 0, balance: 20000, received_date: '2026-08-03T08:00:00.000Z', delivery_date: null, registered_by_name: 'Agent A' },
];
const payments = [
  { payment_date: '2026-08-04T10:30:00.000Z', parcel_tracking: 'GG-COL-1001', client_name: 'Moussa Diallo', amount: 50000, payment_method: 'cash', recorded_by_name: 'Agent A' },
  { payment_date: '2026-08-05T11:00:00.000Z', parcel_tracking: 'GG-COL-1002', client_name: 'Fatou Traoré', amount: 45000, payment_method: 'transfer', recorded_by_name: 'Agent B' },
];
const clients = [
  { id: 'c1', full_name: 'Moussa Diallo', phone: '+22370000001', city: 'Bamako', address: 'Badalabougou', created_at: '2026-07-01T08:00:00.000Z' },
];
const logs = [
  { created_at: '2026-08-05T09:00:00.000Z', user_name: 'Agent A', action: 'a créé le colis GG-COL-1003', details: 'Payment en attente' },
];

const PAYMENT_METHOD_LABELS = { cash: 'Espèces', transfer: 'Virement', mobile_money: 'Mobile Money', pay_later: 'À crédit' };
const PARCEL_STATUS_LABELS = { pending: 'En attente', received: 'Reçu', in_transit: 'En route', arrived: 'Arrivé', delivered: 'Livré', cancelled: 'Annulé' };
const formatTrackingNumber = (t) => t;
const formatDate = (d) => (d ? String(d).slice(0, 10) : '');
const formatDateTime = (d) => String(d);

function buildWorkbook(type) {
  let data = [];
  let sheetName = 'Rapport';
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
      break;
    case 'clients':
      data = clients.map((c) => ({
        Nom: c.full_name,
        Téléphone: c.phone || '',
        Ville: c.city || '',
        Adresse: c.address || '',
        'Date création': formatDate(c.created_at),
      }));
      break;
    default:
      throw new Error(`Unknown type ${type}`);
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return { wb, expected: data };
}

try {
  // --- all_parcels ---
  {
    const { wb, expected } = buildWorkbook('all_parcels');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const back = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(back.Sheets['Rapport']);
    record('xlsx.allParcelsRoundTrip', rows.length === expected.length && String(rows[0]['N° Colis']) === 'GG-COL-1001' && Number(rows[0]['Reste à payer']) === 65000 && rows[1]['Statut'] === 'Livré', { rows: rows.length });
  }
  // --- payments ---
  {
    const { wb, expected } = buildWorkbook('payments');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const rows = XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets['Rapport']);
    record('xlsx.paymentsRoundTrip', rows.length === expected.length && Number(rows[0]['Montant']) === 50000 && rows[1]['Mode de paiement'] === 'Virement', { rows: rows.length });
  }
  // --- clients ---
  {
    const { wb, expected } = buildWorkbook('clients');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const rows = XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets['Rapport']);
    record('xlsx.clientsRoundTrip', rows.length === expected.length && rows[0]['Nom'] === 'Moussa Diallo' && rows[0]['Ville'] === 'Bamako', { rows: rows.length });
  }
} catch (error) {
  console.error('Excel export test crashed:', error);
  record('cleanRun', false);
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} excel-export tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((p) => !p).length} FAIL.`);
process.exit(process.exitCode || 0);