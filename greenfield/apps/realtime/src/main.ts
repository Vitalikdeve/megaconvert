import 'reflect-metadata';

import { loadRealtimeEnvironment } from '@megaconvert/config';

import { createRealtimeApp } from './bootstrap/create-realtime-app';

async function bootstrap(): Promise<void> {
  const environment = loadRealtimeEnvironment();
  const app = await createRealtimeApp(environment);

  await app.listen(environment.PORT, environment.HOST);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start the realtime gateway.', error);
  process.exit(1);
});
