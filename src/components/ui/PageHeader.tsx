import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backLink?: {
    to: string;
    label?: string;
  };
}

export function PageHeader({ title, description, actions, backLink }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="space-y-2">
        {backLink ? (
          <Link
            to={backLink.to}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft size={16} />
            {backLink.label || 'Retour'}
          </Link>
        ) : null}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </motion.div>
  );
}
