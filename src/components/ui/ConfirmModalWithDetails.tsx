import { Modal } from './Modal';

export interface RelatedItemSummary {
  label: string;
  count: number;
}

interface ConfirmModalWithDetailsProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  relatedItems?: RelatedItemSummary[];
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModalWithDetails({
  open,
  onClose,
  onConfirm,
  title,
  message,
  relatedItems = [],
  confirmLabel = 'Confirmer',
  danger = true,
  loading = false,
}: ConfirmModalWithDetailsProps) {
  const hasRelatedItems = relatedItems.some((item) => item.count > 0);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>

        {hasRelatedItems && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
            <p className="mb-2 font-semibold">⚠️ Cette suppression affectera également :</p>
            <ul className="space-y-1">
              {relatedItems
                .filter((item) => item.count > 0)
                .map((item) => (
                  <li key={item.label}>
                    • {item.count} {item.label}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={loading}
          >
            {loading ? 'Suppression...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
