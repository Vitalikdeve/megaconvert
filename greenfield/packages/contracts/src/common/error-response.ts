import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    details: z.unknown().nullable(),
    message: z.string().min(1),
    requestId: z.string().min(1).nullable(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
