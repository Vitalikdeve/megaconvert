import { Module } from '@nestjs/common';

import { AuditShellModule } from '../audit-shell/audit-shell.module';
import { AuthShellModule } from '../auth-shell/auth-shell.module';
import { DatabaseModule } from '../database/database.module';

import { CurrentUserProfileService } from './application/current-user-profile.service';
import { ProfileReadModelService } from './application/profile-read-model.service';
import { UsersService } from './application/users.service';
import { PostgresUsersRepository } from './infrastructure/postgres-users.repository';
import { CurrentUserController } from './interfaces/http/current-user.controller';
import { ProfileReadModelController } from './interfaces/http/profile-read-model.controller';
import { UserActorGuard } from './interfaces/http/user-actor.guard';
import { USERS_REPOSITORY } from './users.constants';

@Module({
  controllers: [CurrentUserController, ProfileReadModelController],
  exports: [UsersService],
  imports: [AuditShellModule, AuthShellModule, DatabaseModule],
  providers: [
    CurrentUserProfileService,
    ProfileReadModelService,
    UsersService,
    UserActorGuard,
    {
      provide: USERS_REPOSITORY,
      useClass: PostgresUsersRepository,
    },
  ],
})
export class UsersModule {}
