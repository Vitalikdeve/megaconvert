'use client';

import { z } from 'zod';

import type { PersistStorage, StorageValue } from 'zustand/middleware';

export interface ValidatedPersistStorageOptions<TState> {
  key: string;
  schema: z.ZodType<TState>;
  storage?: Storage;
}

export function createValidatedPersistStorage<TState>({
  key,
  schema,
  storage,
}: ValidatedPersistStorageOptions<TState>): PersistStorage<TState> {
  const storedStateSchema = z.object({
    state: schema,
    version: z.number().int(),
  });

  return {
    getItem(name) {
      const resolvedStorage = resolveStorage(storage);

      if (!resolvedStorage) {
        return null;
      }

      const rawValue = resolvedStorage.getItem(resolveStorageKey(key, name));

      if (!rawValue) {
        return null;
      }

      try {
        const parsedValue = JSON.parse(rawValue) as unknown;
        const result = storedStateSchema.safeParse(parsedValue);

        if (!result.success) {
          resolvedStorage.removeItem(resolveStorageKey(key, name));
          return null;
        }

        return result.data as StorageValue<TState>;
      } catch {
        resolvedStorage.removeItem(resolveStorageKey(key, name));
        return null;
      }
    },
    removeItem(name) {
      const resolvedStorage = resolveStorage(storage);

      if (!resolvedStorage) {
        return;
      }

      resolvedStorage.removeItem(resolveStorageKey(key, name));
    },
    setItem(name, value) {
      const resolvedStorage = resolveStorage(storage);

      if (!resolvedStorage) {
        return;
      }

      resolvedStorage.setItem(resolveStorageKey(key, name), JSON.stringify(value));
    },
  };
}

function resolveStorageKey(prefix: string, name: string) {
  return name === prefix ? name : `${prefix}:${name}`;
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}
