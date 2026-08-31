import { Package, Clock, Truck, MapPin, PackageCheck, XCircle } from 'lucide-react';
import type { ParcelStatus } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '../../lib/types';

const STATUS_ICONS: Record<ParcelStatus, React.ReactNode> = {
  received: <Package size={12} />,
  pending: <Clock size={12} />,
  in_transit: <Truck size={12} />,
  arrived: <MapPin size={12} />,
  delivered: <PackageCheck size={12} />,
  cancelled: <XCircle size={12} />,
};

export function ParcelStatusIcon({ status }: { status: ParcelStatus }) {
  const icon = STATUS_ICONS[status];
  return <span className="inline-flex">{icon}</span>;
}

export function ParcelStatusBadge({ status }: { status: ParcelStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PARCEL_STATUS_COLORS[status]}`}
      title={PARCEL_STATUS_LABELS[status]}
    >
      {STATUS_ICONS[status]}
      {PARCEL_STATUS_LABELS[status]}
    </span>
  );
}
