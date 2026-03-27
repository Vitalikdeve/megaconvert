import type { z } from 'zod';

export interface ZodDtoClass<TSchema extends z.ZodType<unknown>> {
  readonly schema: TSchema;
}

export function createZodDto<TSchema extends z.ZodType<unknown>>(schema: TSchema) {
  abstract class GeneratedZodDto {
    public static readonly schema = schema;
  }

  return GeneratedZodDto as unknown as ZodDtoClass<TSchema>;
}

export function isZodDtoClass(value: unknown): value is ZodDtoClass<z.ZodType<unknown>> {
  return (
    typeof value === 'function' &&
    'schema' in value &&
    value.schema !== undefined
  );
}
