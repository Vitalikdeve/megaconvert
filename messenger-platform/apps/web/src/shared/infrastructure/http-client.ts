"use client";

export class HttpRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export interface JsonRequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const parseResponseBody = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const requestJson = async <T>({
  url,
  method = "GET",
  body,
  headers,
  signal
}: JsonRequestOptions): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new HttpRequestError(
      `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return payload as T;
};
