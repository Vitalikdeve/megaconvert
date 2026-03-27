import { requestContextStore, type StructuredLogger } from '@megaconvert/server-kit';
import { Inject, Injectable, type LoggerService } from '@nestjs/common';


import { ROOT_LOGGER } from './logging.constants';

interface LogBindings {
  context?: string;
  details?: Record<string, unknown>;
  err?: Error;
}

@Injectable()
export class ApplicationLogger implements LoggerService {
  public constructor(
    @Inject(ROOT_LOGGER) private readonly rootLogger: StructuredLogger,
  ) {}

  public debug(message: unknown, context?: string): void {
    this.write('debug', this.toMessage(message), { context });
  }

  public error(message: unknown, trace?: string, context?: string): void {
    this.write('error', this.toMessage(message), {
      context,
      details: trace ? { trace } : undefined,
    });
  }

  public fatal(message: string, details?: Record<string, unknown>): void {
    this.write('fatal', message, { details });
  }

  public get logger(): StructuredLogger {
    return this.rootLogger;
  }

  public info(message: string, details?: Record<string, unknown>): void {
    this.write('info', message, { details });
  }

  public log(message: unknown, context?: string): void {
    this.write('info', this.toMessage(message), { context });
  }

  public trace(message: string, details?: Record<string, unknown>): void {
    this.write('trace', message, { details });
  }

  public verbose(message: unknown, context?: string): void {
    this.write('trace', this.toMessage(message), { context });
  }

  public warn(message: unknown, context?: string): void {
    this.write('warn', this.toMessage(message), { context });
  }

  private buildScopedLogger(): StructuredLogger {
    const requestContext = requestContextStore.get();

    if (!requestContext) {
      return this.rootLogger;
    }

    return this.rootLogger.child({
      actorId: requestContext.actorId,
      actorType: requestContext.actorType,
      ipAddress: requestContext.ipAddress,
      method: requestContext.method,
      path: requestContext.path,
      requestId: requestContext.correlationId,
      userAgent: requestContext.userAgent,
    });
  }

  private toMessage(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Error) {
      return value.message;
    }

    return JSON.stringify(value);
  }

  private write(level: 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn', message: string, bindings: LogBindings): void {
    const logger = this.buildScopedLogger();
    const payload: Record<string, unknown> = {};

    if (bindings.context) {
      payload.context = bindings.context;
    }

    if (bindings.details) {
      payload.details = bindings.details;
    }

    if (bindings.err) {
      payload.err = bindings.err;
    }

    logger[level](payload, message);
  }
}
