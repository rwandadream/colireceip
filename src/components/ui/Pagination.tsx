import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Select } from './Input';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(totalItems, page * perPage);
  const paginated = totalPages > 1;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Afficher</span>
        <Select
          aria-label="Éléments par page"
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="w-auto px-2 py-1 text-xs"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <span>par page</span>
      </div>
      {paginated ? (
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {start}–{end} sur {totalItems}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              className="min-h-11 min-w-11"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="px-2 text-xs font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
              {page} / {totalPages}
            </span>
            <Button
              className="min-h-11 min-w-11"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      )}
    </div>
  );
}