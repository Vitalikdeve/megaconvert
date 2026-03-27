import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import * as userDomainHooks from '../data/user-domain-hooks';

import { ProfileEditorCard } from './profile-editor-card';

vi.mock('../data/user-domain-hooks', () => ({
  useCurrentProfileQuery: vi.fn(),
  useUpdateProfileMutation: vi.fn(),
}));

const mockedUseCurrentProfileQuery = vi.mocked(userDomainHooks.useCurrentProfileQuery);
const mockedUseUpdateProfileMutation = vi.mocked(userDomainHooks.useUpdateProfileMutation);

describe('ProfileEditorCard', () => {
  it('renders an auth-aware error state when the current-user query fails before data loads', () => {
    mockedUseCurrentProfileQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    mockedUseUpdateProfileMutation.mockReturnValue({
      isError: false,
      isPending: false,
    } as never);

    render(<ProfileEditorCard />);

    expect(screen.getByText('Profile data is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/current session is unavailable/i)).toBeInTheDocument();
  });

  it('renders the editable profile surface when current-user data is available', () => {
    mockedUseCurrentProfileQuery.mockReturnValue({
      data: {
        avatarUrl: null,
        bio: 'Coordinates product quality across chat and meetings.',
        displayName: 'Alex Mercer',
        email: 'alex@example.com',
        id: '11111111-1111-4111-8111-111111111111',
        locale: 'en',
        statusText: 'Available',
        username: 'alex_mercer',
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    mockedUseUpdateProfileMutation.mockReturnValue({
      isError: false,
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);

    render(<ProfileEditorCard />);

    expect(screen.getByDisplayValue('Alex Mercer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alex_mercer')).toBeInTheDocument();
    expect(screen.getByText('Auth-linked')).toBeInTheDocument();
  });
});
