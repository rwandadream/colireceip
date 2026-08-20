import type { Parcel, ParcelItem, ParcelStatus, StatusHistory } from './types';

type OnlineParcelInput = Record<string, unknown>;

const snake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(snake);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), snake(item)]));
  return value;
};

const toParcel = (raw: unknown): Parcel & { items?: ParcelItem[] } => {
  const parcel = snake(raw) as Parcel & { items?: ParcelItem[]; registered_by_id?: string };
  return { ...parcel, registered_by: parcel.registered_by ?? parcel.registered_by_id ?? '' };
};

const toStatusHistory = (raw: unknown): StatusHistory => {
  const history = snake(raw) as StatusHistory & { changed_by_id?: string };
  return { ...history, changed_by: history.changed_by ?? history.changed_by_id ?? '' };
};

const request = async (method: string, id?: string, body?: unknown, extraQuery?: Record<string, string>): Promise<unknown> => {
  const query = new URLSearchParams({ resource: 'parcels', ...extraQuery });
  if (id) query.set('id', id);

  const response = await fetch(`/api/data?${query}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `API_${response.status}`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error) message += `: ${payload.error}`;
    } catch {
      // Keep the HTTP status when the error response has no JSON body.
    }
    throw new Error(message);
  }

  return response.status === 204 ? undefined : (await response.json() as { data: unknown }).data;
};

export const canUseParcelApi = (): boolean => navigator.onLine;
export const isParcelApiUnavailable = (error: unknown): boolean => error instanceof TypeError;

export async function listOnlineParcels(): Promise<Parcel[]> {
  return (await request('GET') as unknown[]).map(toParcel);
}

export async function deleteOnlineParcel(id: string): Promise<void> {
  await request('DELETE', id);
}

export async function updateOnlineParcelStatus(parcelId: string, status: ParcelStatus, note = ''): Promise<Parcel> {
  return toParcel(await request('PATCH', parcelId, { status, note }));
}

export async function listOnlineStatusHistory(parcelId: string): Promise<StatusHistory[]> {
  return (await request('GET', undefined, undefined, { resource: 'status-history', parcelId }) as unknown[]).map(toStatusHistory);
}

export async function createParcelOnline(parcel: OnlineParcelInput, items: Array<{ product_id?: string; designation: string; quantity: number; unit_price: number }>): Promise<{ parcel: Parcel; items: ParcelItem[] }> {
  const payload = await request('POST', undefined, {
      clientId: parcel.client_id, recipientName: parcel.recipient_name, recipientPhone: parcel.recipient_phone,
      recipientAddress: parcel.recipient_address, merchandiseType: parcel.merchandise_type, description: parcel.description,
      weight: parcel.weight, vehicle: parcel.vehicle, origin: parcel.origin, destination: parcel.destination,
      departureBranch: parcel.departure_branch, arrivalBranch: parcel.arrival_branch, packageType: parcel.package_type,
      paymentCondition: parcel.payment_condition, transportPrice: parcel.transport_price, additionalFees: parcel.additional_fees,
      amountPaid: parcel.amount_paid, status: parcel.status, receivedDate: parcel.received_date, tripId: parcel.trip_id,
      tripVehicleId: parcel.trip_vehicle_id, items: items.map((item) => ({ productId: item.product_id, designation: item.designation, quantity: item.quantity, unitPrice: item.unit_price })),
  });
  const converted = toParcel(payload);
  return { parcel: converted, items: converted.items ?? [] };
}
