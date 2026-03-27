import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import * as userDomainHooks from '@/features/profile/data/user-domain-hooks';

import { BlockedUsersCard } from './blocked-users-card';

vi.mock('@/features/profile/data/user-domain-hooks', () => ({
  useBlockedUsersQuery: vi.fn(),
  useBlockUserMutation: vi.fn(),
  useUnblockUserMutation: vi.fn(),
}));

const mockedUseBlockedUsersQuery = vi.mocked(userDomainHooks.useBlockedUsersQuery);
const mockedUseBlockUserMutation = vi.mocked(userDomainHooks.useBlockUserMutation);
const mockedUseUnblockUserMutation = vi.mocked(userDomainHooks.useUnblockUserMutation);

describe('BlockedUsersCard', () => {
  beforeEach(() => {
    mockedUseBlockUserMutation.mockReturnValue({
      isError: false,
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
    mockedUseUnblockUserMutation.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it('renders an empty state when no blocked users exist', () => {
    mockedUseBlockedUsersQuery.mockReturnValue({
      data: {
        blockedUsers: [],
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    render(<BlockedUsersCard />);

    expect(screen.getByText(/no blocked users are currently stored/i)).toBeInTheDocument();
  });

  it('renders blocked user profile cards from the settings safety surface', () => {
    mockedUseBlockedUsersQuery.mockReturnValue({
      data: {
        blockedUsers: [
          {
            blockedAt: '2026-03-27T12:00:00.000Z',
            id: '33333333-3333-4333-8333-333333333333',
            note: 'Escalated safety case',
            user: {
              avatarUrl: null,
              displayName: 'Blocked Member',
              id: '22222222-2222-4222-8222-222222222222',
              statusText: 'Offline',
              username: 'blocked_member',
            },
          },
        ],
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    render(<BlockedUsersCard />);

    expect(screen.getByText('Blocked Member')).toBeInTheDocument();
    expect(screen.getByText('@blocked_member')).toBeInTheDocument();
    expect(screen.getByText('Escalated safety case')).toBeInTheDocument();
  });
});
