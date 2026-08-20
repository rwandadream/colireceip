export class ApiResponseError extends Error {
  status: number;
  constructor(status: number, message: string);
}

export function requestApi(
  resource: string,
  method: string,
  options?: { id?: string; query?: Record<string, string>; body?: unknown; headers?: Record<string, string> }
): Promise<unknown>;

export function isNetworkUnavailable(error: unknown): boolean;
