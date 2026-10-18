/** Anrop till våra Netlify Functions. Svaren kontrolleras mot scheman i shared/apiTypes.ts. */
import * as v from 'valibot';

import { ApiErrorSchema } from '../shared/apiTypes.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(status: number, message: string, fieldErrors: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
  init: RequestInit = {},
): Promise<v.InferOutput<TSchema>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    });
  } catch {
    throw new ApiError(
      0,
      'Ingen kontakt med servern. Kontrollera din internetanslutning och försök igen.',
    );
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = v.safeParse(ApiErrorSchema, data);
    throw error.success
      ? new ApiError(res.status, error.output.error, error.output.fieldErrors ?? {})
      : new ApiError(res.status, 'Något gick fel. Försök igen om en stund.');
  }

  const parsed = v.safeParse(schema, data);
  if (!parsed.success) throw new ApiError(res.status, 'Oväntat svar från servern.');
  return parsed.output;
}

export function apiGet<TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  return request(path, schema);
}

export function apiPost<TSchema extends v.GenericSchema>(
  path: string,
  body: unknown,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  return request(path, schema, { method: 'POST', body: JSON.stringify(body) });
}
