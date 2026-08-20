import type { Trip, TripVehicle } from './types';

const toSnake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnake);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      toSnake(item),
    ]));
  }
  return value;
};

const toTrip = (value: unknown): Trip => {
  const converted = toSnake(value) as Trip & { created_by_id?: string };
  return { ...converted, created_by: converted.created_by ?? converted.created_by_id ?? '' };
};

const request = async (resource: 'trips' | 'trip-vehicles', method: string, id?: string, query?: Record<string, string>, body?: unknown) => {
  const params = new URLSearchParams({ resource, ...query });
  if (id) params.set('id', id);
  const response = await fetch(`/api/data?${params}`, {
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

const tripBody = (data: Partial<Trip>) => ({
  ...(data.trip_number !== undefined ? { tripNumber: data.trip_number } : {}),
  ...(data.trip_date !== undefined ? { tripDate: data.trip_date } : {}),
  ...(data.origin !== undefined ? { origin: data.origin } : {}),
  ...(data.destination !== undefined ? { destination: data.destination } : {}),
  ...(data.status !== undefined ? { status: data.status } : {}),
});

const vehicleBody = (data: Omit<TripVehicle, 'id' | 'vehicle_number' | 'created_at' | 'updated_at'>) => ({
  tripId: data.trip_id,
  registration: data.registration,
  roadBamakoFrontier: data.road_bamako_frontier,
  customsFee: data.customs_fee,
  frontierFormalities: data.frontier_formalities,
  roadFrontierBouake: data.road_frontier_bouake,
  roadBouakeAbidjan: data.road_bouake_abidjan,
  roadAbidjan: data.road_abidjan,
  loadingFee: data.loading_fee,
  unloadingFee: data.unloading_fee,
  truckQuota: data.truck_quota,
  monthlyFee: data.monthly_fee,
});

export const canUseTripApi = () => navigator.onLine;
export const isTripApiUnavailable = (error: unknown) => error instanceof TypeError;

export async function listOnlineTrips(): Promise<Trip[]> { return (await request('trips', 'GET') as unknown[]).map(toTrip); }
export async function createOnlineTrip(data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<Trip> { return toTrip(await request('trips', 'POST', undefined, undefined, tripBody(data))); }
export async function updateOnlineTrip(id: string, data: Partial<Trip>): Promise<Trip> { return toTrip(await request('trips', 'PATCH', id, undefined, tripBody(data))); }
export async function deleteOnlineTrip(id: string): Promise<void> { await request('trips', 'DELETE', id); }
export async function listOnlineTripVehicles(tripId: string): Promise<TripVehicle[]> { return toSnake(await request('trip-vehicles', 'GET', undefined, { tripId })) as TripVehicle[]; }
export async function createOnlineTripVehicle(data: Omit<TripVehicle, 'id' | 'vehicle_number' | 'created_at' | 'updated_at'>): Promise<TripVehicle> { return toSnake(await request('trip-vehicles', 'POST', undefined, undefined, vehicleBody(data))) as TripVehicle; }
export async function deleteOnlineTripVehicle(id: string): Promise<void> { await request('trip-vehicles', 'DELETE', id); }
