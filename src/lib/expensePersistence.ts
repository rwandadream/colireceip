import type { TripExpense } from './types';
import { ApiError, fetchWithTimeout, isTransientApiError } from './api';

export type ExpenseCreateInput = Pick<
  TripExpense,
  'parcel_id' | 'trip_id' | 'trip_vehicle_id' | 'category_id' | 'category_name' | 'label' | 'amount' | 'expense_date' | 'location' | 'notes'
>;

const toSnake = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(toSnake)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
          toSnake(item),
        ])
      )
    : value;

const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'expenses' });
  if (id) query.set('id', id);
  const response = await fetchWithTimeout(`/api/data?${query}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = `API_${response.status}`;
    try {
      const parsed = await response.json();
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) message = parsed.error;
    } catch {
      // keep the API_### fallback
    }
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? undefined : ((await response.json()) as { data: unknown }).data;
};

export const canUseExpenseApi = () => navigator.onLine;
export const isExpenseApiUnavailable = (error: unknown): boolean => isTransientApiError(error);

export async function listOnlineExpenses(): Promise<TripExpense[]> {
  return toSnake(await request('GET')) as TripExpense[];
}

export async function createOnlineExpense(data: ExpenseCreateInput, id?: string): Promise<TripExpense> {
  return toSnake(
    await request('POST', undefined, {
      ...(id ? { id } : {}),
      parcelId: data.parcel_id,
      tripId: data.trip_id,
      tripVehicleId: data.trip_vehicle_id,
      categoryId: data.category_id,
      categoryName: data.category_name,
      label: data.label,
      amount: data.amount,
      expenseDate: data.expense_date,
      location: data.location ?? '',
      notes: data.notes ?? '',
    })
  ) as TripExpense;
}

export async function updateOnlineExpense(id: string, data: Partial<TripExpense>): Promise<TripExpense> {
  return toSnake(
    await request('PATCH', id, {
      ...(data.parcel_id !== undefined ? { parcelId: data.parcel_id } : {}),
      ...(data.category_name !== undefined ? { categoryName: data.category_name } : {}),
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.expense_date !== undefined ? { expenseDate: data.expense_date } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.trip_id !== undefined ? { tripId: data.trip_id } : {}),
      ...(data.trip_vehicle_id !== undefined ? { tripVehicleId: data.trip_vehicle_id } : {}),
      ...(data.category_id !== undefined ? { categoryId: data.category_id } : {}),
    })
  ) as TripExpense;
}

export async function deleteOnlineExpense(id: string): Promise<void> {
  await request('DELETE', id);
}