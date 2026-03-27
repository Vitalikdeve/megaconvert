import { z } from 'zod';

export const responseMetaSchema = z.object({
  requestId: z.string().min(1).nullable(),
  timestamp: z.string().datetime(),
});

export function createResponseEnvelopeSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z.object({
    data: dataSchema,
    meta: responseMetaSchema,
  });
}

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
