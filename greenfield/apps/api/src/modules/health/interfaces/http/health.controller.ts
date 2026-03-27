import { Controller, Get, Inject, Res } from '@nestjs/common';

import { HealthQueryService } from '../../application/health-query.service';

import type { FastifyReply } from 'fastify';

@Controller('health')
export class HealthController {
  public constructor(
    @Inject(HealthQueryService) private readonly healthQueryService: HealthQueryService,
  ) {}

  @Get('live')
  public getLiveness() {
    return this.healthQueryService.getLiveness();
  }

  @Get('ready')
  public async getReadiness(@Res() response: FastifyReply): Promise<void> {
    const report = await this.healthQueryService.getReadiness();
    const statusCode = report.status === 'down' ? 503 : 200;

    response.status(statusCode).send(report);
  }
}
