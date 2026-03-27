import 'reflect-metadata';

import { loadWorkerEnvironment } from '@megaconvert/config';

import { createWorkerApp } from './bootstrap/create-worker-app';

async function bootstrap(): Promise<void> {
  const environment = loadWorkerEnvironment();
  const app = await createWorkerApp(environment);

  await app.listen(environment.PORT, environment.HOST);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start the worker application.', error);
  process.exit(1);
});
