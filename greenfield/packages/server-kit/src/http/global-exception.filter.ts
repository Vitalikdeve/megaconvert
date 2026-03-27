import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ZodError } from 'zod';

import type { StructuredLogger } from '../logging/root-logger';
import type { ErrorResponse } from '@megaconvert/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';


@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  public constructor(private readonly logger?: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response = context.getResponse<FastifyReply>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.resolveHttpExceptionMessage(exception)
        : exception instanceof ZodError
          ? 'Request validation failed.'
        : 'Unexpected server error.';

    const body: ErrorResponse = {
      error: {
        code: this.resolveErrorCode(exception, statusCode),
        details:
          exception instanceof HttpException
            ? exception.getResponse()
            : exception instanceof ZodError
              ? {
                  issues: exception.issues,
                }
              : null,
        message,
        requestId: typeof request.id === 'string' ? request.id : null,
      },
    };

    this.logException(exception, request, statusCode, body.error.code);
    this.sendResponse(response, statusCode, body);
  }

  private logException(
    exception: unknown,
    request: FastifyRequest,
    statusCode: number,
    errorCode: string,
  ): void {
    if (!this.logger) {
      return;
    }

    const logLevel = statusCode >= 500 ? 'error' : 'warn';

    this.logger[logLevel](
      {
        err: exception instanceof Error ? exception : undefined,
        errorCode,
        method: request.method,
        requestId: request.id,
        route: request.url,
        statusCode,
      },
      'Request failed.',
    );
  }

  private resolveErrorCode(exception: unknown, statusCode: number): string {
    if (exception instanceof ZodError) {
      return 'validation_error';
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    return statusCode >= 500 ? 'internal_error' : 'request_failed';
  }

  private resolveHttpExceptionMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }

    return exception.message;
  }

  private sendResponse(
    response: FastifyReply,
    statusCode: number,
    body: ErrorResponse,
  ): void {
    if (typeof response.code === 'function') {
      response.code(statusCode).send(body);
      return;
    }

    if (typeof response.status === 'function') {
      response.status(statusCode).send(body);
      return;
    }

    const rawResponse = response as unknown as {
      end(payload?: string): void;
      setHeader(name: string, value: string): void;
      statusCode: number;
    };

    rawResponse.statusCode = statusCode;
    rawResponse.setHeader('content-type', 'application/json; charset=utf-8');
    rawResponse.end(JSON.stringify(body));
  }
}
