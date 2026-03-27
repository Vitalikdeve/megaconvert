import { Inject, Injectable } from '@nestjs/common';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';

@Injectable()
export class SystemService {
  public constructor(
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
  ) {}

  public getOverview() {
    return {
      implementedModules: [
        'database',
        'health',
        'messaging-gateway',
        'redis',
        'realtime-events',
        'system',
        'system-gateway',
      ],
      reservedRealtimeDomains: ['presence', 'typing'],
      service: this.runtimeContext.service,
    };
  }
}
