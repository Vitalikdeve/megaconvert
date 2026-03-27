import { type DynamicModule, Module } from '@nestjs/common';

import { WORKER_RUNTIME_CONTEXT, type WorkerRuntimeContext } from './bootstrap/runtime-context';
import { HealthModule } from './modules/health/health.module';
import { SystemModule } from './modules/system/system.module';

@Module({})
export class AppModule {
  public static register(runtimeContext: WorkerRuntimeContext): DynamicModule {
    return {
      exports: [WORKER_RUNTIME_CONTEXT],
      global: true,
      imports: [HealthModule, SystemModule],
      module: AppModule,
      providers: [
        {
          provide: WORKER_RUNTIME_CONTEXT,
          useValue: runtimeContext,
        },
      ],
    };
  }
}
