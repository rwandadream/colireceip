export type UserRole = 'admin' | 'agent';

export type ParcelStatus =
  | 'received'
  | 'pending'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled';

export type TripStatus = 'planned' | 'in_transit' | 'arrived' | 'closed' | 'cancelled';

export interface Trip {
  id: string;
  trip_number: string;
  trip_date: string;
  origin: string;
  destination: string;
  status: TripStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TripVehicle {
  id: string;
  trip_id: string;
  vehicle_number: number;
  registration: string;
  road_bamako_frontier: number;
  customs_fee: number;
  frontier_formalities: number;
  road_frontier_bouake: number;
  road_bouake_abidjan: number;
  road_abidjan: number;
  loading_fee: number;
  unloading_fee: number;
  truck_quota: number;
  monthly_fee: number;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'cash' | 'orange_money' | 'wave' | 'bank_transfer';

export interface User {
  id: string;
  email?: string;
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
  company_name?: string;
  email?: string;
  city: string;
  neighborhood?: string;
  address: string;
  reference?: string;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  default_price: number;
  created_at: string;
  updated_at: string;
}

export interface ParcelItem {
  id: string;
  parcel_id: string;
  product_id?: string;
  designation: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export type PaymentCondition = 'paid_origin' | 'paid_destination' | 'partial' | 'unpaid';

export interface Parcel {
  id: string;
  tracking_number: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  merchandise_type: string;
  description: string;
  quantity: number;
  weight: number;
  vehicle: string;
  trip_id?: string;
  trip_vehicle_id?: string;
  origin: string;
  destination: string;
  departure_branch: string;
  arrival_branch: string;
  agent_id: string;
  agent_name: string;
  payment_condition: PaymentCondition;
  package_type: 'Petit colis' | 'Gros colis';
  sub_total: number;
  transport_price: number;
  additional_fees: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: ParcelStatus;
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

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TripExpense {
  id: string;
  parcel_id: string;
  trip_id?: string;
  trip_vehicle_id?: string;
  category_id?: string;
  category_name: string;
  label: string;
  amount: number;
  expense_date: string;
  location: string;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
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
  default_origin?: string;
  default_destination?: string;
}

export type AttachmentEntityType = 'parcel' | 'expense' | 'payment';

export interface Attachment {
  id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  storage_path?: string;
  url?: string;
  blob?: Blob;
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
  received: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
  pending: 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  in_transit: 'border border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300',
  arrived: 'border border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-300',
  delivered: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  cancelled: 'border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
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
