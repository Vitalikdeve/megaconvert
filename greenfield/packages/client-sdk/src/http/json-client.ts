export interface SchemaParser<TValue> {
  parse(input: unknown): TValue;
}

export interface JsonClientOptions {
  baseUrl?: string | URL;
  defaultHeaders?: HeadersInit;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface JsonRequestOptions<TValue> extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | null;
  query?: Record<string, PrimitiveQueryValue | PrimitiveQueryValue[]>;
  schema?: SchemaParser<TValue>;
  timeoutMs?: number;
}

type PrimitiveQueryValue = boolean | number | string | null | undefined;

export type JsonClientErrorKind =
  | 'aborted'
  | 'http'
  | 'invalid_response'
  | 'network'
  | 'schema_validation'
  | 'timeout';

export interface JsonClientErrorOptions<TPayload> {
  kind: JsonClientErrorKind;
  message: string;
  method: string;
  originalError?: unknown;
  payload?: TPayload | null;
  requestId?: string | null;
  statusCode: number;
  url: string;
}

export class JsonClientError<TPayload = unknown> extends Error {
  public readonly kind: JsonClientErrorKind;
  public readonly method: string;
  public readonly originalError: unknown;
  public readonly payload: TPayload | null;
  public readonly requestId: string | null;
  public readonly statusCode: number;
  public readonly url: string;

  public constructor({
    kind,
    message,
    method,
    originalError = null,
    payload = null,
    requestId = null,
    statusCode,
    url,
  }: JsonClientErrorOptions<TPayload>) {
    super(message, originalError ? { cause: originalError } : undefined);
    this.name = 'JsonClientError';
    this.kind = kind;
    this.method = method;
    this.originalError = originalError;
    this.payload = payload;
    this.requestId = requestId;
    this.statusCode = statusCode;
    this.url = url;
  }
}

export interface JsonClient {
  delete<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
  get<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
  patch<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
  post<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
  put<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
  request<TValue = unknown>(path: string, options?: JsonRequestOptions<TValue>): Promise<TValue>;
}

export function createJsonClient(options: JsonClientOptions = {}): JsonClient {
  return {
    delete: (path, requestOptions) =>
      request(path, {
        ...requestOptions,
        method: 'DELETE',
      }, options),
    get: (path, requestOptions) =>
      request(path, {
        ...requestOptions,
        method: 'GET',
      }, options),
    patch: (path, requestOptions) =>
      request(path, {
        ...requestOptions,
        method: 'PATCH',
      }, options),
    post: (path, requestOptions) =>
      request(path, {
        ...requestOptions,
        method: 'POST',
      }, options),
    put: (path, requestOptions) =>
      request(path, {
        ...requestOptions,
        method: 'PUT',
      }, options),
    request: (path, requestOptions) => request(path, requestOptions, options),
  };
}

export async function getJson<TValue>(
  input: string | URL,
  options?: Omit<JsonRequestOptions<TValue>, 'method'>,
): Promise<TValue> {
  return request(
    typeof input === 'string' ? input : input.toString(),
    {
      ...options,
      method: 'GET',
    },
    {},
  );
}

async function request<TValue>(
  path: string,
  options: JsonRequestOptions<TValue> = {},
  clientOptions: JsonClientOptions,
): Promise<TValue> {
  const abortController = new AbortController();
  const timeoutMs = options.timeoutMs ?? clientOptions.timeoutMs;
  const requestMethod = (options.method ?? 'GET').toUpperCase();
  const requestUrl = buildRequestUrl(path, clientOptions.baseUrl, options.query);
  let timeoutTriggered = false;
  const timeoutHandle =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? setTimeout(() => {
          timeoutTriggered = true;
          abortController.abort();
        }, timeoutMs)
      : null;

  const mergedSignal = mergeAbortSignals(options.signal, abortController.signal);

  try {
    const response = await (clientOptions.fetchImpl ?? fetch)(requestUrl, {
      ...options,
      body: normalizeBody(options.body),
      headers: buildHeaders(clientOptions.defaultHeaders, options.headers, options.body),
      signal: mergedSignal,
    });

    const payload = await parseResponsePayload(response, requestMethod, requestUrl);
    const requestId = extractRequestId(payload) ?? response.headers.get('x-request-id');

    if (!response.ok) {
      throw new JsonClientError({
        kind: 'http',
        message: extractErrorMessage(payload),
        method: requestMethod,
        payload,
        requestId,
        statusCode: response.status,
        url: requestUrl,
      });
    }

    if (!options.schema) {
      return payload as TValue;
    }

    try {
      return options.schema.parse(payload);
    } catch (error) {
      throw new JsonClientError({
        kind: 'schema_validation',
        message: 'Response validation failed.',
        method: requestMethod,
        originalError: error,
        payload,
        requestId,
        statusCode: response.status,
        url: requestUrl,
      });
    }
  } catch (error) {
    if (error instanceof JsonClientError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new JsonClientError({
        kind: timeoutTriggered ? 'timeout' : 'aborted',
        message: timeoutTriggered ? 'Request timed out.' : 'Request was aborted.',
        method: requestMethod,
        originalError: error,
        statusCode: timeoutTriggered ? 408 : 499,
        url: requestUrl,
      });
    }

    throw new JsonClientError({
      kind: 'network',
      message: 'Request failed before a response was received.',
      method: requestMethod,
      originalError: error,
      statusCode: 0,
      url: requestUrl,
    });
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildRequestUrl(
  path: string,
  baseUrl?: string | URL,
  query?: Record<string, PrimitiveQueryValue | PrimitiveQueryValue[]>,
): string {
  if (!baseUrl) {
    try {
      const absoluteUrl = new URL(path);

      applyQueryParameters(absoluteUrl, query);
      return absoluteUrl.toString();
    } catch {
      // Relative paths should continue through the local URL branch below.
    }
  }

  const url = baseUrl ? new URL(path, baseUrl) : new URL(path, 'http://localhost');

  applyQueryParameters(url, query);

  if (baseUrl) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

function applyQueryParameters(
  url: URL,
  query?: Record<string, PrimitiveQueryValue | PrimitiveQueryValue[]>,
): void {
  if (!query) {
    return;
  }

  for (const [key, rawValue] of Object.entries(query)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }

      url.searchParams.append(key, String(value));
    }
  }
}

function buildHeaders(
  defaultHeaders?: HeadersInit,
  requestHeaders?: HeadersInit,
  body?: BodyInit | Record<string, unknown> | null,
): Headers {
  const headers = new Headers(defaultHeaders ?? {});

  headers.set('accept', 'application/json');

  if (requestHeaders) {
    const sourceHeaders = new Headers(requestHeaders);

    sourceHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (isJsonBody(body) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

function normalizeBody(body?: BodyInit | Record<string, unknown> | null): BodyInit | null | undefined {
  if (!body) {
    return body;
  }

  if (isJsonBody(body)) {
    return JSON.stringify(body);
  }

  return body;
}

function isJsonBody(body: BodyInit | Record<string, unknown> | null | undefined): body is Record<string, unknown> {
  if (!body) {
    return false;
  }

  return !(
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    typeof body === 'string'
  );
}

async function parseResponsePayload(
  response: Response,
  requestMethod: string,
  requestUrl: string,
): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text.length > 0 ? text : null;
  }

  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new JsonClientError({
      kind: 'invalid_response',
      message: 'Response body was not valid JSON.',
      method: requestMethod,
      originalError: error,
      requestId: response.headers.get('x-request-id'),
      statusCode: response.status,
      url: requestUrl,
    });
  }
}

function extractErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (typeof payload === 'object' && payload !== null) {
    const candidate = Reflect.get(payload, 'error');

    if (typeof candidate === 'object' && candidate !== null) {
      const message = Reflect.get(candidate, 'message');

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }
  }

  return 'Request failed.';
}

function extractRequestId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const error = Reflect.get(payload, 'error');

  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const requestId = Reflect.get(error, 'requestId');
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : null;
}

function mergeAbortSignals(
  ...signals: Array<AbortSignal | null | undefined>
): AbortSignal | undefined {
  const activeSignals = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined && signal !== null,
  );

  if (activeSignals.length === 0) {
    return undefined;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();

  for (const signal of activeSignals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener(
      'abort',
      () => {
        controller.abort();
      },
      { once: true },
    );
  }

  return controller.signal;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
