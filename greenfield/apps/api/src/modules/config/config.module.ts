import { Global, Module } from '@nestjs/common';

import {
  API_RUNTIME_CONTEXT,
  type ApiRuntimeContext,
} from '../../bootstrap/runtime-context';

import { ApiConfigService } from './api-config.service';
import { API_ENVIRONMENT } from './config.constants';

import type { DynamicModule} from '@nestjs/common';

@Global()
@Module({})
export class ConfigModule {
  public static register(runtimeContext: ApiRuntimeContext): DynamicModule {
    return {
      exports: [API_ENVIRONMENT, API_RUNTIME_CONTEXT, ApiConfigService],
      global: true,
      module: ConfigModule,
      providers: [
        {
          provide: API_RUNTIME_CONTEXT,
          useValue: runtimeContext,
        },
        {
          provide: API_ENVIRONMENT,
          useValue: runtimeContext.environment,
        },
        ApiConfigService,
      ],
    };
  }
}
