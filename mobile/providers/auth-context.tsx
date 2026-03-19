import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

const USERNAME_PATTERN = /^[a-z0-9_]{4,24}$/;

export type GoogleAccount = {
  id: string;
  email: string;
  fullName: string;
  avatarUri: string | null;
};

export type BusinessProfile = {
  username: string;
  fullName: string;
  email: string;
  avatarUri: string | null;
  isPro: boolean;
};

type CompleteProfileInput = {
  username: string;
  avatarUri: string | null;
};

type AuthContextValue = {
  googleAccount: GoogleAccount | null;
  profile: BusinessProfile | null;
  setGoogleAccount: (account: GoogleAccount) => void;
  completeProfile: (input: CompleteProfileInput) => Promise<BusinessProfile>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'PROFILE_SAVE_FAILED';
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

async function saveProfileToBackend(payload: {
  googleAccount: GoogleAccount;
  username: string;
  avatarUri: string | null;
}): Promise<{ username: string; avatarUri: string | null; isPro: true }> {
  const requestBody = {
    fullName: payload.googleAccount.fullName,
    email: payload.googleAccount.email,
    avatarUri: payload.avatarUri,
    username: payload.username,
    isPro: true as const,
  };

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      username: requestBody.username,
      avatarUri: requestBody.avatarUri,
      isPro: true,
    };
  }

  const saveUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/mobile/profile`;
  const response = await fetch(saveUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 409) {
    throw new Error('USERNAME_TAKEN');
  }

  if (!response.ok) {
    throw new Error('PROFILE_SAVE_FAILED');
  }

  let responseBody: Partial<{ username: string; avatarUri: string }> = {};
  try {
    responseBody = (await response.json()) as Partial<{ username: string; avatarUri: string }>;
  } catch {
    responseBody = {};
  }

  return {
    username: responseBody.username ?? requestBody.username,
    avatarUri: responseBody.avatarUri ?? requestBody.avatarUri,
    isPro: true,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [googleAccount, setGoogleAccountState] = useState<GoogleAccount | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      googleAccount,
      profile,
      setGoogleAccount: (account) => {
        setGoogleAccountState(account);
        setProfile(null);
      },
      completeProfile: async (input) => {
        if (!googleAccount) {
          throw new Error('NOT_AUTHENTICATED');
        }

        const normalizedUsername = normalizeUsername(input.username);
        if (!USERNAME_PATTERN.test(normalizedUsername)) {
          throw new Error('USERNAME_INVALID');
        }

        try {
          const backendProfile = await saveProfileToBackend({
            googleAccount,
            username: normalizedUsername,
            avatarUri: input.avatarUri,
          });

          const nextProfile: BusinessProfile = {
            username: backendProfile.username,
            avatarUri: backendProfile.avatarUri,
            fullName: googleAccount.fullName,
            email: googleAccount.email,
            isPro: true,
          };

          setProfile(nextProfile);
          return nextProfile;
        } catch (error) {
          throw new Error(toErrorCode(error));
        }
      },
      signOut: () => {
        setGoogleAccountState(null);
        setProfile(null);
      },
    }),
    [googleAccount, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
