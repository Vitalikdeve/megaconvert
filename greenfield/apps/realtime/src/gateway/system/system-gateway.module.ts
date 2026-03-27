import { Module } from '@nestjs/common';

import { SystemGateway } from './system.gateway';

@Module({
  providers: [SystemGateway],
})
export class SystemGatewayModule {}
