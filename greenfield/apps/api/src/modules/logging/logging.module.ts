import { createRootLogger } from '@megaconvert/server-kit';
import { Global, Module } from '@nestjs/common';


import { ApiConfigService } from '../config/api-config.service';

import { ApplicationLogger } from './application-logger.service';
import { RequestContextMiddleware } from './infrastructure/request-context.middleware';
import { ROOT_LOGGER } from './logging.constants';

@Global()
@Module({
  exports: [ApplicationLogger, RequestContextMiddleware, ROOT_LOGGER],
  providers: [
    {
      inject: [ApiConfigService],
      provide: ROOT_LOGGER,
      useFactory: (configService: ApiConfigService) =>
        createRootLogger({
          environment: configService.environment.NODE_ENV,
          level: configService.environment.LOG_LEVEL,
          serviceName: configService.service.name,
        }),
    },
    ApplicationLogger,
    RequestContextMiddleware,
  ],
})
export class LoggingModule {}
