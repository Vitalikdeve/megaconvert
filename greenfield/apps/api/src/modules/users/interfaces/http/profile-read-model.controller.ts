import {
  UseResponseEnvelope,
  createZodDto,
  ZodValidationPipe,
} from '@megaconvert/server-kit';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { ProfileReadModelService } from '../../application/profile-read-model.service';

import { UserActorGuard } from './user-actor.guard';

const profileCardsQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(50)),
});

const ProfileCardsQueryDto = createZodDto(profileCardsQuerySchema);

type ProfileCardsQuery = z.infer<typeof profileCardsQuerySchema>;

@Controller('users')
@UseGuards(UserActorGuard)
export class ProfileReadModelController {
  public constructor(
    @Inject(ProfileReadModelService)
    private readonly profileReadModelService: ProfileReadModelService,
  ) {}

  @Get('profile-cards')
  @UseResponseEnvelope()
  public async getProfileCards(
    @Query(new ZodValidationPipe(ProfileCardsQueryDto)) query: ProfileCardsQuery,
  ) {
    return this.profileReadModelService.getProfileCards(query.ids);
  }
}
