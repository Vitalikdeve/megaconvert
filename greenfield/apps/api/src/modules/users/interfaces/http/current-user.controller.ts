import {
  blockUserRequestSchema,
  updateUserPreferencesSchema,
  updateUserPrivacySettingsSchema,
  updateUserProfileSchema,
} from '@megaconvert/contracts';
import {
  UseResponseEnvelope,
  createZodDto,
  ZodValidationPipe,
} from '@megaconvert/server-kit';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentActor } from '../../../auth-shell/interfaces/http/current-actor.decorator';
import { CurrentUserProfileService } from '../../application/current-user-profile.service';

import { UserActorGuard } from './user-actor.guard';

import type { UserActor } from '../../../auth-shell/domain/request-actor';
import type {
  BlockUserRequest,
  UpdateUserPreferencesInput,
  UpdateUserPrivacySettingsInput,
  UpdateUserProfileInput,
} from '@megaconvert/contracts';

const BlockUserRequestDto = createZodDto(blockUserRequestSchema);
const UpdateUserProfileDto = createZodDto(updateUserProfileSchema);
const UpdateUserPrivacySettingsDto = createZodDto(updateUserPrivacySettingsSchema);
const UpdateUserPreferencesDto = createZodDto(updateUserPreferencesSchema);
const blockedUserParamSchema = z.object({
  blockedUserId: z.string().uuid(),
});
const BlockedUserParamDto = createZodDto(blockedUserParamSchema);

type BlockedUserParam = z.infer<typeof blockedUserParamSchema>;

@Controller('users/me')
@UseGuards(UserActorGuard)
export class CurrentUserController {
  public constructor(
    @Inject(CurrentUserProfileService)
    private readonly currentUserProfileService: CurrentUserProfileService,
  ) {}

  @Post('blocked-users')
  @UseResponseEnvelope()
  public async blockUser(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(BlockUserRequestDto)) input: BlockUserRequest,
  ) {
    return this.currentUserProfileService.blockUser(actor.id, input);
  }

  @Get()
  @UseResponseEnvelope()
  public async getCurrentUserProfile(@CurrentActor() actor: UserActor) {
    return this.currentUserProfileService.getCurrentUserProfile(actor.id);
  }

  @Get('blocked-users')
  @UseResponseEnvelope()
  public async getBlockedUsers(@CurrentActor() actor: UserActor) {
    return {
      blockedUsers: await this.currentUserProfileService.listBlockedUsers(actor.id),
    };
  }

  @Get('preferences')
  @UseResponseEnvelope()
  public async getPreferences(@CurrentActor() actor: UserActor) {
    return this.currentUserProfileService.getPreferences(actor.id);
  }

  @Get('privacy')
  @UseResponseEnvelope()
  public async getPrivacy(@CurrentActor() actor: UserActor) {
    return this.currentUserProfileService.getPrivacySettings(actor.id);
  }

  @Delete('blocked-users/:blockedUserId')
  @UseResponseEnvelope()
  public async unblockUser(
    @CurrentActor() actor: UserActor,
    @Param(new ZodValidationPipe(BlockedUserParamDto)) params: BlockedUserParam,
  ) {
    return this.currentUserProfileService.unblockUser(actor.id, params.blockedUserId);
  }

  @Put('preferences')
  @UseResponseEnvelope()
  public async updatePreferences(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(UpdateUserPreferencesDto)) input: UpdateUserPreferencesInput,
  ) {
    return this.currentUserProfileService.updatePreferences(actor.id, input);
  }

  @Put('privacy')
  @UseResponseEnvelope()
  public async updatePrivacy(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(UpdateUserPrivacySettingsDto))
    input: UpdateUserPrivacySettingsInput,
  ) {
    return this.currentUserProfileService.updatePrivacySettings(actor.id, input);
  }

  @Patch('profile')
  @UseResponseEnvelope()
  public async updateProfile(
    @CurrentActor() actor: UserActor,
    @Body(new ZodValidationPipe(UpdateUserProfileDto)) input: UpdateUserProfileInput,
  ) {
    return this.currentUserProfileService.updateProfile(actor.id, input);
  }
}
