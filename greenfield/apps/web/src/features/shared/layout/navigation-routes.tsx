import {
  Bell,
  CircleUserRound,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings2,
  UsersRound,
  Video,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export interface WorkspaceNavigationRoute {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  matchMode?: 'exact' | 'prefix';
  section: 'primary' | 'secondary';
  shortLabel: string;
}

export const workspaceNavigationRoutes: readonly WorkspaceNavigationRoute[] = [
  {
    description: 'System overview and active workspace signals.',
    href: '/',
    icon: LayoutDashboard,
    label: 'Overview',
    matchMode: 'exact',
    section: 'primary',
    shortLabel: 'Home',
  },
  {
    description: 'Conversation index, unread focus, and navigation.',
    href: '/inbox',
    icon: Inbox,
    label: 'Inbox',
    matchMode: 'prefix',
    section: 'primary',
    shortLabel: 'Inbox',
  },
  {
    description: 'Conversation canvas, composer, and thread layout.',
    href: '/chats',
    icon: MessageSquareText,
    label: 'Chat',
    matchMode: 'prefix',
    section: 'primary',
    shortLabel: 'Chat',
  },
  {
    description: 'Meeting rooms, call launch surfaces, and control plane.',
    href: '/meetings',
    icon: Video,
    label: 'Meetings',
    matchMode: 'prefix',
    section: 'primary',
    shortLabel: 'Meet',
  },
  {
    description: 'People directory, availability, and relationship surfaces.',
    href: '/contacts',
    icon: UsersRound,
    label: 'Contacts',
    matchMode: 'prefix',
    section: 'primary',
    shortLabel: 'People',
  },
  {
    description: 'Global command and search workflows.',
    href: '/search',
    icon: Search,
    label: 'Search',
    matchMode: 'prefix',
    section: 'primary',
    shortLabel: 'Search',
  },
  {
    description: 'System and personal notification streams.',
    href: '/notifications',
    icon: Bell,
    label: 'Notifications',
    matchMode: 'prefix',
    section: 'secondary',
    shortLabel: 'Alerts',
  },
  {
    description: 'Shared files, media, and artifact views.',
    href: '/files',
    icon: FolderKanban,
    label: 'Files',
    matchMode: 'prefix',
    section: 'secondary',
    shortLabel: 'Files',
  },
  {
    description: 'Appearance, preferences, and workspace configuration.',
    href: '/settings',
    icon: Settings2,
    label: 'Settings',
    matchMode: 'prefix',
    section: 'secondary',
    shortLabel: 'Prefs',
  },
  {
    description: 'Profile, session, and account surfaces.',
    href: '/profile',
    icon: CircleUserRound,
    label: 'Profile',
    matchMode: 'prefix',
    section: 'secondary',
    shortLabel: 'Profile',
  },
] as const;

export const mobileWorkspaceRoutes = workspaceNavigationRoutes.filter((route) =>
  ['/', '/inbox', '/meetings', '/search', '/profile'].includes(route.href),
);

export const primaryWorkspaceRoutes = workspaceNavigationRoutes.filter(
  (route) => route.section === 'primary',
);

export const secondaryWorkspaceRoutes = workspaceNavigationRoutes.filter(
  (route) => route.section === 'secondary',
);

export function getWorkspaceRoute(pathname: string): WorkspaceNavigationRoute {
  return (
    workspaceNavigationRoutes.find((route) => isWorkspaceRouteActive(pathname, route)) ??
    workspaceNavigationRoutes[0]!
  );
}

export function isWorkspaceRouteActive(pathname: string, route: WorkspaceNavigationRoute): boolean {
  if (route.matchMode === 'exact') {
    return pathname === route.href;
  }

  if (route.href === '/') {
    return pathname === '/';
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}
