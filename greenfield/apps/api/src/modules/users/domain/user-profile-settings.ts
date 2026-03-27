export type VisibilityScope = 'contacts_only' | 'everyone' | 'nobody';

export type DefaultWorkspaceView = 'inbox' | 'meetings' | 'search';

export type PreferredMeetingLayout = 'grid' | 'spotlight';

export interface UserProfileCard {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  statusText: string | null;
  username: string;
}

export interface UserPrivacySettings {
  directMessageScope: VisibilityScope;
  discoverableByEmail: boolean;
  discoverableByUsername: boolean;
  meetingPresenceScope: VisibilityScope;
  presenceScope: VisibilityScope;
  profileScope: VisibilityScope;
  readReceiptsEnabled: boolean;
}

export interface UserPreferences {
  compactModeEnabled: boolean;
  defaultWorkspaceView: DefaultWorkspaceView;
  keyboardShortcutsEnabled: boolean;
  localeOverride: string | null;
  playSoundEffects: boolean;
  preferredMeetingLayout: PreferredMeetingLayout;
  timeZone: string | null;
}

export interface BlockedUserRecord {
  blockedAt: Date;
  id: string;
  note: string | null;
  user: UserProfileCard;
}
