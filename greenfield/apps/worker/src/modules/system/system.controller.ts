import { Controller, Get, Inject } from '@nestjs/common';

import { SystemService } from './system.service';

@Controller()
export class SystemController {
  public constructor(
    @Inject(SystemService) private readonly systemService: SystemService,
  ) {}

  @Get()
  public getOverview() {
    return this.systemService.getOverview();
  }
}
