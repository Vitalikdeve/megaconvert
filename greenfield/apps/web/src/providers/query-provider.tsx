'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { createQueryClient } from '@/lib/query/create-query-client';

import type { PropsWithChildren } from 'react';


export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
