import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-context';

export default function IndexScreen() {
  const { googleAccount, profile } = useAuth();

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return <Redirect href="/(tabs)/contacts" />;
}
