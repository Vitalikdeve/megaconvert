import 'reflect-metadata';

import { loadApiEnvironment } from '@megaconvert/config';
import { createRootLogger } from '@megaconvert/server-kit';

import { createApiApp } from './bootstrap/create-api-app';
import { ApplicationLogger } from './modules/logging/application-logger.service';

async function bootstrap(): Promise<void> {
  const environment = loadApiEnvironment();
  const fallbackLogger = createRootLogger({
    environment: environment.NODE_ENV,
    level: environment.LOG_LEVEL,
    serviceName: 'api',
  });

  try {
    const app = await createApiApp(environment);
    await app.listen(environment.PORT, environment.HOST);
    app.get(ApplicationLogger).info('API foundation booted successfully.', {
      host: environment.HOST,
      port: environment.PORT,
      publicOrigin: environment.PUBLIC_ORIGIN,
    });
  } catch (error) {
    fallbackLogger.fatal(
      {
        err: error instanceof Error ? error : undefined,
      },
      'Failed to start the API application.',
    );
    process.exit(1);
  }
}

void bootstrap();
