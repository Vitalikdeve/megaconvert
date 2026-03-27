import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
} from '@nestjs/common';
import { ZodError, type z } from 'zod';

import { isZodDtoClass, type ZodDtoClass } from './create-zod-dto';

import type {
  PipeTransform} from '@nestjs/common';

export type ZodSchemaInput<TOutput> =
  | z.ZodType<TOutput>
  | ZodDtoClass<z.ZodType<TOutput>>;

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform {
  public constructor(private readonly schemaOrDto: ZodSchemaInput<TOutput>) {}

  public transform(value: unknown, _metadata: ArgumentMetadata): TOutput {
    const schema = this.resolveSchema(this.schemaOrDto);

    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          code: 'validation_error',
          issues: error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
          message: 'Request validation failed.',
        });
      }

      throw error;
    }
  }

  private resolveSchema(schemaOrDto: ZodSchemaInput<TOutput>): z.ZodType<TOutput> {
    return isZodDtoClass(schemaOrDto) ? schemaOrDto.schema : schemaOrDto;
  }
}
