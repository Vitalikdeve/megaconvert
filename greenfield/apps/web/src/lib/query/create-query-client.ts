'use client';

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
      queries: {
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 20_000,
      },
    },
  });
}
