import type { Parcel, ParcelItem } from './types';

type OnlineParcelInput = Record<string, unknown>;

const snake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(snake);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), snake(item)]));
  return value;
};

export async function createParcelOnline(parcel: OnlineParcelInput, items: Array<{ product_id?: string; designation: string; quantity: number; unit_price: number }>): Promise<{ parcel: Parcel; items: ParcelItem[] }> {
  const response = await fetch('/api/data?resource=parcels', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: parcel.client_id, recipientName: parcel.recipient_name, recipientPhone: parcel.recipient_phone,
      recipientAddress: parcel.recipient_address, merchandiseType: parcel.merchandise_type, description: parcel.description,
      weight: parcel.weight, vehicle: parcel.vehicle, origin: parcel.origin, destination: parcel.destination,
      departureBranch: parcel.departure_branch, arrivalBranch: parcel.arrival_branch, packageType: parcel.package_type,
      paymentCondition: parcel.payment_condition, transportPrice: parcel.transport_price, additionalFees: parcel.additional_fees,
      amountPaid: parcel.amount_paid, status: parcel.status, receivedDate: parcel.received_date, tripId: parcel.trip_id,
      tripVehicleId: parcel.trip_vehicle_id, items: items.map((item) => ({ productId: item.product_id, designation: item.designation, quantity: item.quantity, unitPrice: item.unit_price })),
    }),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Online operation was not authorized.' : 'Online operation failed.');
  const payload = await response.json() as { data: unknown };
  const converted = snake(payload.data) as Parcel & { items: ParcelItem[] };
  return { parcel: converted, items: converted.items };
}
