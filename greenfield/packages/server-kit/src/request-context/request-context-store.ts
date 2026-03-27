import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextValue {
  actorId: string | null;
  actorType: string | null;
  correlationId: string;
  ipAddress: string | null;
  method: string;
  path: string;
  userAgent: string | null;
}

class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<RequestContextValue>();

  public get(): RequestContextValue | undefined {
    return this.storage.getStore();
  }

  public run<TValue>(context: RequestContextValue, callback: () => TValue): TValue {
    return this.storage.run(context, callback);
  }

  public update(patch: Partial<RequestContextValue>): void {
    const currentContext = this.storage.getStore();

    if (!currentContext) {
      return;
    }

    Object.assign(currentContext, patch);
  }
}

export const requestContextStore = new RequestContextStore();
