import { type ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-slate-800 rounded-t-[2rem] sm:rounded-2xl shadow-2xl animate-slide-up-sheet sm:animate-scale-in max-h-[92vh] sm:max-h-[90vh] flex flex-col outline-none`}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3.5 mb-1 sm:hidden flex-shrink-0" />
        
        {title && (
          <div className="flex items-center justify-between px-5 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-700/50">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto scrollbar-thin flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = true,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">
          Annuler
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={danger ? 'btn-danger' : 'btn-primary'}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
