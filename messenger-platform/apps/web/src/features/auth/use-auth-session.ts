"use client";

import { useEffect, useState } from "react";

import {
  clearAuthSession,
  persistAuthSession,
  readAuthSession
} from "./application/auth-session.service";
import type { AuthCredentials, AuthSession } from "./domain/auth.types";
import { login, register } from "./infrastructure/auth-api";

export const useAuthSession = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  const runAuthAction = async (
    action: (credentials: AuthCredentials) => Promise<AuthSession>,
    credentials: AuthCredentials
  ) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const nextSession = await action(credentials);
      persistAuthSession(nextSession);
      setSession(nextSession);
      return nextSession;
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Authentication failed."
      );
      throw authError;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    session,
    isSubmitting,
    error,
    register: (credentials: AuthCredentials) =>
      runAuthAction(register, credentials),
    login: (credentials: AuthCredentials) => runAuthAction(login, credentials),
    logout: () => {
      clearAuthSession();
      setSession(null);
      setError(null);
    }
  };
};
