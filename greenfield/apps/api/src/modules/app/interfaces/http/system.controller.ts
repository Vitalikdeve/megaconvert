import {
  UseResponseEnvelope,
  createZodDto,
  ZodValidationPipe,
} from '@megaconvert/server-kit';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { z } from 'zod';

import { SystemOverviewService } from '../../application/system-overview.service';

const systemOverviewQuerySchema = z.object({
  verbose: z
    .preprocess((value) => {
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const normalizedValue = value.trim().toLowerCase();

      if (['1', 'on', 'true', 'yes'].includes(normalizedValue)) {
        return true;
      }

      if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
        return false;
      }

      return value;
    }, z.boolean())
    .default(false),
});

const SystemOverviewQueryDto = createZodDto(systemOverviewQuerySchema);

type SystemOverviewQuery = z.infer<typeof systemOverviewQuerySchema>;

@Controller()
export class SystemController {
  public constructor(
    @Inject(SystemOverviewService)
    private readonly systemOverviewService: SystemOverviewService,
  ) {}

  @Get()
  @UseResponseEnvelope()
  public getOverview(
    @Query(new ZodValidationPipe(SystemOverviewQueryDto)) query: SystemOverviewQuery,
  ) {
    return this.systemOverviewService.getOverview(query.verbose);
  }
}
