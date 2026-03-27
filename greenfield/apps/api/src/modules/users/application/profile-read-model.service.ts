import { Inject, Injectable } from '@nestjs/common';

import { UsersService } from './users.service';

import type { UserProfileCardsResponse } from '@megaconvert/contracts';

@Injectable()
export class ProfileReadModelService {
  public constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  public async getProfileCards(userIds: readonly string[]): Promise<UserProfileCardsResponse> {
    return {
      profiles: await this.usersService.listProfileCards(userIds),
    };
  }
}
