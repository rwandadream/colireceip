import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  const controlId = useId();
  const errorId = useId();
  return (
    <div>
      {label && <label htmlFor={controlId} className="label">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={label ? controlId : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`input ${icon ? 'pl-10' : ''} ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, error, children, className = '', ...props }: SelectProps) {
  const controlId = useId();
  const errorId = useId();
  return (
    <div>
      {label && <label htmlFor={controlId} className="label">{label}</label>}
      <select id={label ? controlId : undefined} aria-describedby={error ? errorId : undefined} className={`input cursor-pointer ${error ? 'border-error-500' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  const controlId = useId();
  const errorId = useId();
  return (
    <div>
      {label && <label htmlFor={controlId} className="label">{label}</label>}
      <textarea id={label ? controlId : undefined} aria-describedby={error ? errorId : undefined} className={`input resize-none ${error ? 'border-error-500' : ''} ${className}`} {...props} />
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>}
    </div>
  );
}