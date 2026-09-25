import { config } from '@/lib/config';

/**
 * Fetch wrapper for the console API.
 *
 * Every call goes to /api/admin-console on the Spllit backend and carries the
 * caller's Firebase ID token. The token is all the client contributes to
 * authorisation — the role and its permissions are re-read from the database
 * on the server for each request, so nothing here can grant itself access by
 * lying about who it is.
 */

export class ApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Signed out, or the session expired. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /**
   * Signed in, but this role may not do it.
   *
   * 404 counts. The backend answers 404 rather than 403 to non-admins so that
   * an unprivileged caller cannot confirm the surface exists — which means a
   * 404 from this API is very often "not an admin", not "no such record".
   */
  get isForbidden(): boolean {
    return this.status === 403 || this.status === 404;
  }

  /** Which permission the route wanted, when the backend said. */
  get requiredPermission(): string | null {
    const value = this.details?.required;
    return typeof value === 'string' ? value : null;
  }
}

/** Set once by the auth provider, so this module never imports Firebase. */
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: (() => Promise<string | null>) | null): void {
  tokenGetter = fn;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

/** The backend's envelope for these routes. */
interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

/**
 * Send a file.
 *
 * Separate from api() because that one JSON-encodes every body and sets a
 * JSON content type. A multipart body has to carry its own boundary, which
 * only the browser can generate — setting Content-Type by hand here produces
 * a request the server cannot parse, and the failure looks like a rejected
 * file rather than a malformed request.
 */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  if (!config.api.baseUrl) {
    throw new ApiError(
      'The console is not configured with an API address.',
      0,
      'not_configured',
    );
  }

  const root = config.api.baseUrl;
  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  const url = `${base}/admin-console${path.startsWith('/') ? path : `/${path}`}`;

  const token = tokenGetter ? await tokenGetter() : null;
  const form = new FormData();
  form.append('file', file);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError('Could not reach the Spllit API. Check your connection.', 0, 'network');
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message ?? `Upload failed (${response.status})`,
      response.status,
      payload?.code,
    );
  }

  return payload.data as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  if (!config.api.baseUrl) {
    // Stated as configuration rather than a network problem: the API URL is
    // inlined at build time, so no amount of retrying will fix it and telling
    // someone to "check their connection" sends them the wrong way entirely.
    throw new ApiError(
      'The console is not configured with an API address. NEXT_PUBLIC_API_URL was missing at build time.',
      0,
      'not_configured',
    );
  }

  const url = new URL(
    `${config.api.baseUrl.replace(/\/$/, '')}/admin-console${path.startsWith('/') ? path : `/${path}`}`,
  );

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const token = tokenGetter ? await tokenGetter() : null;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the Spllit API. Check your connection.', 0, 'network');
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    // A body that is not JSON is usually an infrastructure page — a gateway
    // timeout or a CORS rejection — rather than anything this layer models.
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.code,
      (payload as unknown as { data?: Record<string, unknown> })?.data,
    );
  }

  return payload.data as T;
}
