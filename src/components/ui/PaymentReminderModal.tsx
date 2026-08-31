import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { Modal } from './Modal';

interface PaymentReminderModalProps {
  open: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
  tracking: string;
  balance: number;
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; description?: string }) => void;
}

export function PaymentReminderModal({
  open,
  onClose,
  clientName,
  clientPhone,
  tracking,
  balance,
  addToast,
}: PaymentReminderModalProps) {
  const [copied, setCopied] = useState(false);

  const message = [
    `Bonjour ${clientName || ''},`,
    '',
    `Nous vous rappelons qu'il reste un solde de ${balance.toLocaleString('fr-FR')} FCFA à régler pour votre colis ${tracking}.`,
    'Merci de bien vouloir procéder au paiement. Nous restons à votre disposition.',
    '',
    'Cordialement,',
    "Groupe-Gaff",
  ]
    .join('\n')
    .trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      addToast({ type: 'success', title: 'Message copié', description: 'Le rappel de paiement a été copié dans le presse-papiers.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: 'error', title: 'Copie impossible', description: 'Impossible de copier le message.' });
    }
  };

  const handleWhatsApp = () => {
    if (clientPhone) {
      window.open(`https://wa.me/${clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    } else {
      addToast({ type: 'warning', title: 'Aucun téléphone', description: 'Le client ne possède pas de numéro de téléphone enregistré.' });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Relancer le paiement" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Un message de rappel pour <span className="font-semibold">{clientName || 'le client'}</span> concernant le solde de{' '}
          <span className="font-semibold">{balance.toLocaleString('fr-FR')} FCFA</span> a été préparé.
        </p>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
          <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200 font-sans leading-relaxed">{message}</pre>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={handleCopy} className="btn-secondary" type="button">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copié' : 'Copier le message'}
          </button>
          <button onClick={handleWhatsApp} className="btn-primary" type="button">
            <MessageCircle size={16} />
            Envoyer via WhatsApp
          </button>
        </div>
      </div>
    </Modal>
  );
}
