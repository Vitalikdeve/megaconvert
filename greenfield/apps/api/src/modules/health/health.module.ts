import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

import { HealthQueryService } from './application/health-query.service';
import { HealthController } from './interfaces/http/health.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthQueryService],
})
export class HealthModule {}
