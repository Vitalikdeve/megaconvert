import { runMigrations, type DatabaseClient } from '@megaconvert/database';
import { Inject, Injectable } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';
import { ApplicationLogger } from '../../logging/application-logger.service';
import { DATABASE_CLIENT } from '../database.constants';

@Injectable()
export class DatabaseMigrationService {
  public constructor(
    @Inject(DATABASE_CLIENT) private readonly client: DatabaseClient,
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
    @Inject(ApplicationLogger) private readonly logger: ApplicationLogger,
  ) {}

  public async runPendingMigrations(): Promise<void> {
    await runMigrations(this.client);
    this.logger.info('Database migrations completed.', {
      service: this.configService.service.name,
    });
  }
}
