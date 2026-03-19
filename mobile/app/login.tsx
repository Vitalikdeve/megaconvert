import { FontAwesome } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';

WebBrowser.maybeCompleteAuthSession();

type GoogleUserInfo = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('GOOGLE_PROFILE_FAILED');
  }

  return (await response.json()) as GoogleUserInfo;
}

export default function LoginScreen() {
  const router = useRouter();
  const { setGoogleAccount } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const googleConfig = useMemo(
    () => ({
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
    }),
    []
  );

  const hasClientIds = Boolean(
    googleConfig.androidClientId || googleConfig.iosClientId || googleConfig.webClientId
  );

  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === 'error') {
      setErrorMessage('Google авторизация завершилась ошибкой. Попробуйте снова.');
      return;
    }

    if (response.type !== 'success') {
      return;
    }

    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      setErrorMessage('Не удалось получить токен Google. Проверьте настройки OAuth.');
      return;
    }

    setIsLoadingProfile(true);
    setErrorMessage(null);
    fetchGoogleProfile(accessToken)
      .then((googleUser) => {
        const resolvedName = googleUser.name?.trim() || 'Новый пользователь';
        const resolvedEmail = googleUser.email?.trim();
        if (!resolvedEmail) {
          throw new Error('GOOGLE_EMAIL_REQUIRED');
        }

        setGoogleAccount({
          id: googleUser.id || googleUser.sub || resolvedEmail,
          email: resolvedEmail,
          fullName: resolvedName,
          avatarUri: googleUser.picture || null,
        });
        router.replace('/setup-profile');
      })
      .catch((error) => {
        if (error instanceof Error && error.message === 'GOOGLE_EMAIL_REQUIRED') {
          setErrorMessage('Google не вернул email. Используйте аккаунт с открытым email.');
          return;
        }
        setErrorMessage('Не удалось получить профиль Google. Проверьте соединение и попробуйте ещё раз.');
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, [response, router, setGoogleAccount]);

  const canLogin = Boolean(request) && hasClientIds && !isLoadingProfile;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <View style={styles.content}>
        <BrandLogo size={94} />
        <Text style={styles.title}>MegaConvert Business</Text>
        <Text style={styles.subtitle}>
          Корпоративный мессенджер для защищенной коммуникации команд и клиентов.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={!canLogin}
          onPress={() => {
            setErrorMessage(null);
            promptAsync();
          }}
          style={({ pressed }) => [
            styles.googleButton,
            !canLogin && styles.googleButtonDisabled,
            pressed && canLogin ? styles.googleButtonPressed : null,
          ]}>
          {isLoadingProfile ? (
            <ActivityIndicator color={premiumPalette.textPrimary} />
          ) : (
            <>
              <FontAwesome name="google" size={20} color={premiumPalette.textPrimary} />
              <Text style={styles.googleButtonLabel}>Войти через Google</Text>
            </>
          )}
        </Pressable>

        {!hasClientIds ? (
          <Text style={styles.hint}>
            Добавьте Google Client ID в `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,
            `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` или `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
          </Text>
        ) : null}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -90,
    right: -50,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#0D3F84',
    opacity: 0.38,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: '#103D74',
    opacity: 0.26,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 360,
  },
  googleButton: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    minHeight: 56,
    backgroundColor: premiumPalette.accentStrong,
    borderWidth: 1,
    borderColor: '#318FFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  googleButtonDisabled: {
    opacity: 0.55,
  },
  googleButtonLabel: {
    color: premiumPalette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    marginTop: 14,
    color: premiumPalette.textSecondary,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    marginTop: 8,
    color: '#FF7D7D',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
});
