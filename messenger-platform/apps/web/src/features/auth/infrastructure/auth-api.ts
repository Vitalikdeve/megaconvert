"use client";

import { API_URL } from "@/config/api";
import { HttpRequestError, requestJson } from "@/shared/infrastructure/http-client";

import type { AuthCredentials, AuthSession } from "../domain/auth.types";

const readString = (
  source: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

const normalizeAuthSession = (
  credentials: AuthCredentials,
  payload: unknown
): AuthSession => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const nestedUser =
      record.user && typeof record.user === "object"
        ? (record.user as Record<string, unknown>)
        : undefined;

    return {
      username:
        readString(record, ["username"]) ??
        (nestedUser ? readString(nestedUser, ["username"]) : undefined) ??
        credentials.username,
      userId:
        readString(record, ["userId", "id"]) ??
        (nestedUser ? readString(nestedUser, ["userId", "id"]) : undefined),
      token:
        readString(record, ["token", "accessToken", "jwt"]) ??
        (nestedUser ? readString(nestedUser, ["token"]) : undefined)
    };
  }

  return {
    username: credentials.username
  };
};

const resolveAuthError = (payload: unknown) => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = readString(record, ["error", "message"]);

    if (message) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  return null;
};

const submitAuthRequest = async (
  path: "/register" | "/login",
  credentials: AuthCredentials
) => {
  const payload = await requestJson<unknown>({
    url: `${API_URL}${path}`,
    method: "POST",
    body: credentials
  });

  const authError = resolveAuthError(payload);

  if (authError) {
    throw new HttpRequestError(authError, 200, payload);
  }

  return normalizeAuthSession(credentials, payload);
};

export const register = (credentials: AuthCredentials) =>
  submitAuthRequest("/register", credentials);

export const login = (credentials: AuthCredentials) =>
  submitAuthRequest("/login", credentials);
