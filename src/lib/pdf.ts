import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Parcel, Payment } from './types';
import { PARCEL_STATUS_LABELS, PAYMENT_METHOD_LABELS } from './types';
import { formatCurrency, formatDateTime } from './format';

export function generateReceiptPDF(parcel: Parcel, payments: Payment[]): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSIT MALI CI', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Transport de colis Bamako - Abidjan', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Tél: +223 76 00 00 00 | Email: contact@transitmali.ci', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setLineWidth(0.3);
  doc.line(10, y, pageWidth - 10, y);
  y += 8;

  // Receipt title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RECU DE COLIS', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Tracking number
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(parcel.tracking_number, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Info table
  autoTable(doc, {
    startY: y,
    theme: 'striped',
    headStyles: { fontSize: 8, fillColor: [37, 99, 235] },
    bodyStyles: { fontSize: 8 },
    head: [['Information', 'Détails']],
    body: [
      ['Client', parcel.client_name],
      ['Téléphone', parcel.client_phone || '—'],
      ['Type de marchandise', parcel.merchandise_type || '—'],
      ['Description', parcel.description || '—'],
      ['Quantité', String(parcel.quantity)],
      ['Poids', parcel.weight ? `${parcel.weight} kg` : '—'],
      ['Trajet', `${parcel.origin} → ${parcel.destination}`],
      ['Statut', PARCEL_STATUS_LABELS[parcel.status]],
      ['Date de réception', formatDateTime(parcel.received_date)],
      ['Enregistré par', parcel.registered_by_name],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Financial summary
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fontSize: 9, fillColor: [22, 163, 74] },
    bodyStyles: { fontSize: 9 },
    head: [['Désignation', 'Montant']],
    body: [
      ['Prix de transport', formatCurrency(parcel.transport_price)],
      ['Frais supplémentaires', formatCurrency(parcel.additional_fees)],
      ['Montant total', formatCurrency(parcel.total_amount)],
      ['Montant payé', formatCurrency(parcel.amount_paid)],
      ['Reste à payer', formatCurrency(parcel.balance)],
    ],
    foot: [['Reste à payer', formatCurrency(parcel.balance)]],
    footStyles: { fontSize: 10, fillColor: [220, 38, 38] },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Payment history
  if (payments.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fontSize: 8, fillColor: [100, 116, 139] },
      bodyStyles: { fontSize: 8 },
      head: [['Date', 'Mode', 'Montant', 'Agent']],
      body: payments.map((p) => [
        formatDateTime(p.payment_date),
        PAYMENT_METHOD_LABELS[p.payment_method],
        formatCurrency(p.amount),
        p.recorded_by_name,
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Reçu généré le ${formatDateTime(new Date().toISOString())} - Transit Mali CI`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  doc.save(`recu-${parcel.tracking_number}.pdf`);
}

export function generateReportPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  subtitle?: string
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSIT MALI CI', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  if (subtitle) {
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
  }
  y += 8;
  doc.setLineWidth(0.3);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    headStyles: { fontSize: 8, fillColor: [37, 99, 235] },
    bodyStyles: { fontSize: 8 },
    head: [headers],
    body: rows as any,
    styles: { cellPadding: 2 },
  });

  doc.save(`rapport-${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
