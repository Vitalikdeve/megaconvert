export type UserAccountStatus = 'active' | 'suspended';

export interface UserAccount {
  accountStatus: UserAccountStatus;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  displayName: string;
  email: string;
  emailVerifiedAt: Date | null;
  familyName: string | null;
  givenName: string | null;
  id: string;
  lastAuthenticatedAt: Date | null;
  locale: string | null;
  statusText: string | null;
  updatedAt: Date;
  username: string;
}

export interface GoogleIdentityProfile {
  email: string;
  emailVerified: boolean;
  familyName: string | null;
  givenName: string | null;
  locale: string | null;
  picture: string | null;
  profile: Record<string, unknown>;
  subject: string;
  userAgent: string | null;
}
