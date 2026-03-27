import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const defaultWorkspaceViewEnum = pgEnum('default_workspace_view', [
  'inbox',
  'meetings',
  'search',
]);

export const preferredMeetingLayoutEnum = pgEnum('preferred_meeting_layout', [
  'grid',
  'spotlight',
]);

export const userPreferencesTable = pgTable(
  'user_preferences',
  {
    compactModeEnabled: boolean('compact_mode_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    defaultWorkspaceView: defaultWorkspaceViewEnum('default_workspace_view')
      .notNull()
      .default('inbox'),
    keyboardShortcutsEnabled: boolean('keyboard_shortcuts_enabled').notNull().default(true),
    localeOverride: text('locale_override'),
    playSoundEffects: boolean('play_sound_effects').notNull().default(true),
    preferredMeetingLayout: preferredMeetingLayoutEnum('preferred_meeting_layout')
      .notNull()
      .default('grid'),
    timeZone: text('time_zone'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .primaryKey()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    defaultWorkspaceViewIndex: index('user_preferences_default_workspace_view_idx').on(
      table.defaultWorkspaceView,
    ),
  }),
);
