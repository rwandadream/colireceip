export type UserRole = 'admin' | 'agent';

export type ParcelStatus =
  | 'received'
  | 'pending'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'orange_money' | 'wave' | 'bank_transfer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  active: boolean;
  password?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  city: string;
  address: string;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Parcel {
  id: string;
  tracking_number: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  merchandise_type: string;
  description: string;
  quantity: number;
  weight: number;
  transport_price: number;
  additional_fees: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: ParcelStatus;
  origin: string;
  destination: string;
  received_date: string;
  departure_date: string | null;
  arrival_date: string | null;
  delivery_date: string | null;
  registered_by: string;
  registered_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  parcel_id: string;
  parcel_tracking: string;
  client_id: string;
  client_name: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  recorded_by: string;
  recorded_by_name: string;
  note: string;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  parcel_id: string;
  parcel_tracking: string;
  previous_status: ParcelStatus | null;
  new_status: ParcelStatus;
  changed_by: string;
  changed_by_name: string;
  note: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  company_name: string;
  company_phone: string;
  company_email: string;
  bamako_address: string;
  abidjan_address: string;
  default_transport_price: number;
  currency: string;
}

export interface DashboardStats {
  total_parcels: number;
  received_today: number;
  pending: number;
  in_transit: number;
  arrived: number;
  delivered: number;
  cancelled: number;
  total_clients: number;
  collected_today: number;
  pending_payments: number;
  total_revenue: number;
  total_outstanding: number;
}

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  received: 'Reçu',
  pending: 'En attente',
  in_transit: 'En route',
  arrived: 'Arrivé',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export const PARCEL_STATUS_COLORS: Record<ParcelStatus, string> = {
  received: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_transit: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  arrived: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  wave: 'Wave',
  bank_transfer: 'Virement bancaire',
};

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  orange_money: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  wave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  bank_transfer: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

export const PARCEL_STATUSES: ParcelStatus[] = [
  'received',
  'pending',
  'in_transit',
  'arrived',
  'delivered',
  'cancelled',
];
