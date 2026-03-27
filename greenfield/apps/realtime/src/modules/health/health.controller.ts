import { Controller, Get, Inject, Res } from '@nestjs/common';

import { HealthService } from './health.service';

import type { FastifyReply } from 'fastify';


@Controller('health')
export class HealthController {
  public constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get('live')
  public getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  public async getReadiness(@Res() response: FastifyReply): Promise<void> {
    const report = await this.healthService.getReadiness();
    const statusCode = report.status === 'down' ? 503 : 200;

    response.status(statusCode).send(report);
  }
}
