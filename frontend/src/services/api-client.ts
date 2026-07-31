import { publicEnv } from '../config/public-env';

const apiBaseUrl = publicEnv.apiBaseUrl;
const apiErrorEvent = 'thpt-pct-pt:api-error';
export const AUTH_TOKEN_REFRESHED_EVENT = 'thpt-pct-pt:auth-token-refreshed';
export const AUTH_SESSION_EXPIRED_EVENT = 'thpt-pct-pt:auth-session-expired';

type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  skipAuthRefresh?: boolean;
  suppressErrorToast?: boolean;
  responseType?: 'json' | 'blob';
};

type RefreshResponse = {
  accessToken: string;
};

let refreshRequest: Promise<string | null> | null = null;

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function notifyApiError(error: ApiClientError) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(apiErrorEvent, {
      detail: {
        message: error.message,
        status: error.status,
        requestId: error.requestId,
      },
    }),
  );
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;

  refreshRequest = (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const body = (await response.json()) as Partial<RefreshResponse>;
      if (typeof body.accessToken !== 'string' || !body.accessToken) {
        return null;
      }

      window.dispatchEvent(
        new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT, {
          detail: { accessToken: body.accessToken },
        }),
      );
      return body.accessToken;
    } catch {
      return null;
    } finally {
      refreshRequest = null;
    }
  })();

  return refreshRequest;
}

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}) {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers = new Headers(options.headers);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));

  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(buildUrl(path, options.params), {
    ...init,
    headers,
    credentials: 'include',
  });

  if (
    response.status === 401 &&
    headers.has('Authorization') &&
    !options.skipAuthRefresh &&
    path !== '/auth/refresh' &&
    path !== '/auth/login' &&
    path !== '/auth/logout'
  ) {
    const refreshedAccessToken = await refreshAccessToken();

    if (refreshedAccessToken) {
      headers.set('Authorization', `Bearer ${refreshedAccessToken}`);
      response = await fetch(buildUrl(path, options.params), {
        ...init,
        headers,
        credentials: 'include',
      });
    } else {
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    }
  }

  if (!response.ok) {
    const rawBody = await response.text();
    let message = rawBody || `API request failed with status ${response.status}`;
    let requestId: string | undefined;

    try {
      const body = JSON.parse(rawBody) as {
        message?: unknown;
        error?: unknown;
        requestId?: unknown;
      };
      if (typeof body.message === 'string') message = body.message;
      else if (typeof body.error === 'string') message = body.error;
      if (typeof body.requestId === 'string') requestId = body.requestId;
    } catch {
      // Keep the raw response text when the API did not return JSON.
    }

    const error = new ApiClientError(message, response.status, requestId);
    if (!options.suppressErrorToast) {
      notifyApiError(error);
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { method: 'GET' }, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(
      path,
      {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      options,
    );
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(
      path,
      {
        method: 'PUT',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      options,
    );
  },
  upload<T>(path: string, formData: FormData, options?: RequestOptions) {
    return request<T>(
      path,
      {
        method: 'POST',
        body: formData,
      },
      options,
    );
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(
      path,
      {
        method: 'PATCH',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      options,
    );
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { method: 'DELETE' }, options);
  },
  download(path: string, options?: RequestOptions) {
    return request<Blob>(path, { method: 'GET' }, {
      ...options,
      responseType: 'blob',
    });
  },
};
