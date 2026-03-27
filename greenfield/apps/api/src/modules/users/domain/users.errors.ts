export type UsersDomainErrorCode =
  | 'blocked_user_not_found'
  | 'cannot_block_self'
  | 'profile_update_failed'
  | 'user_not_found'
  | 'username_taken';

export class UsersDomainError extends Error {
  public constructor(public readonly code: UsersDomainErrorCode) {
    super(code);
    this.name = 'UsersDomainError';
  }
}
