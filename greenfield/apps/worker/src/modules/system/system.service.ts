import { Inject, Injectable } from '@nestjs/common';

import { WORKER_RUNTIME_CONTEXT, type WorkerRuntimeContext } from '../../bootstrap/runtime-context';

@Injectable()
export class SystemService {
  public constructor(
    @Inject(WORKER_RUNTIME_CONTEXT) private readonly runtimeContext: WorkerRuntimeContext,
  ) {}

  public getOverview() {
    return {
      implementedModules: ['health', 'system'],
      runtime: {
        uptimeSeconds: Math.round(process.uptime()),
      },
      service: this.runtimeContext.service,
    };
  }
}
