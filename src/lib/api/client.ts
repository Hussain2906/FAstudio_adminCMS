export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
  accessToken?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<TResponse, TBody = unknown>(path: string, options: ApiRequestOptions<TBody> = {}): Promise<TResponse> {
    const { method = 'GET', body, headers, signal, accessToken } = options;
    const requestHeaders = new Headers(headers);

    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
    if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    if (typeof document !== 'undefined' && method !== 'GET') {
      const csrfToken = document.cookie.match(/(?:^|; )fs_admin_csrf=([^;]*)/)?.[1];
      if (csrfToken) requestHeaders.set('X-CSRF-Token', decodeURIComponent(csrfToken));
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${path.replace(/^\//, '')}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        credentials: 'include',
        cache: 'no-store',
      });
    } catch (error) {
      throw new ApiError('Unable to reach the backend.', 0, error);
    }

    const payload = await this.parseResponse(response);
    if (!response.ok) {
      const message = this.getErrorMessage(payload, response.statusText);
      throw new ApiError(message, response.status, payload);
    }

    return payload as TResponse;
  }

  async upload<TResponse>(path: string, file: File, onProgress?: (progress: number) => void): Promise<TResponse> {
    const form = new FormData();
    form.append('file', file);
    const csrfToken = document.cookie.match(/(?:^|; )fs_admin_csrf=([^;]*)/)?.[1];
    return new Promise<TResponse>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${this.baseUrl}/${path.replace(/^\//, '')}`);
      request.withCredentials = true;
      if (csrfToken) request.setRequestHeader('X-CSRF-Token', decodeURIComponent(csrfToken));
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('error', () => reject(new ApiError('Unable to reach the backend.', 0)));
      request.addEventListener('load', () => {
        let payload: unknown;
        try { payload = request.responseText ? JSON.parse(request.responseText) : undefined; } catch { payload = request.responseText; }
        if (request.status < 200 || request.status >= 300) { reject(new ApiError(this.getErrorMessage(payload, request.statusText), request.status, payload)); return; }
        onProgress?.(100);
        resolve(payload as TResponse);
      });
      request.send(form);
    });
  }

  get<TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<TResponse>(path, { ...options, method: 'GET' });
  }

  post<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'POST', body });
  }

  patch<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PATCH', body });
  }

  put<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PUT', body });
  }

  delete<TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<TResponse>(path, { ...options, method: 'DELETE' });
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private getErrorMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = payload.message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
    return fallback || 'The backend request failed.';
  }
}

export const apiClient = new ApiClient();
