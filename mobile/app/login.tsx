import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';
import { toast } from '@/src/utils/toast';

WebBrowser.maybeCompleteAuthSession();

const ALPHA_BYPASS_MODE_ENABLED = true;
const ALPHA_AUTH_STORAGE_KEY = 'megaconvert.alpha.auth';
const GOOGLE_AUTH_NOT_CONFIGURED_MESSAGE = 'GMS Google Auth не настроен.';
const CONSENT_REQUIRED_MESSAGE = 'Пожалуйста, примите условия соглашения для продолжения';
const LEGAL_TERMS_URL = 'https://megaconvert.com/legal/terms';
const LEGAL_PRIVACY_URL = 'https://megaconvert.com/legal/privacy';

type GoogleUserInfo = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type GoogleConfig = {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
  scopes: string[];
};

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizedEnvValue(value: string | undefined): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function resolveGoogleConfig(): GoogleConfig {
  return {
    androidClientId: normalizedEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    iosClientId: normalizedEnvValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    webClientId: normalizedEnvValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    scopes: ['openid', 'profile', 'email'],
  };
}

function getRequiredClientId(config: GoogleConfig): string | undefined {
  if (Platform.OS === 'android') {
    return config.androidClientId;
  }
  if (Platform.OS === 'ios') {
    return config.iosClientId;
  }
  return config.webClientId;
}

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const googleConfig = useMemo(() => resolveGoogleConfig(), []);
  const requiredClientId = useMemo(() => getRequiredClientId(googleConfig), [googleConfig]);
  const isGoogleConfigured = Boolean(requiredClientId);

  const alphaBypassEnabled = useMemo(() => {
    if (ALPHA_BYPASS_MODE_ENABLED) {
      return true;
    }
    return !isGoogleConfigured || isTruthyEnv(process.env.EXPO_PUBLIC_ALPHA_BYPASS_LOGIN);
  }, [isGoogleConfigured]);

  const handleAlphaLogin = useCallback(async () => {
    const mockUser = { id: 'alpha_' + Date.now(), name: 'Alpha Tester' };
    const alphaAccount = {
      id: mockUser.id,
      email: `${mockUser.id}@megaconvert.local`,
      fullName: mockUser.name,
      avatarUri: null,
    };

    try {
      await AsyncStorage.setItem(
        ALPHA_AUTH_STORAGE_KEY,
        JSON.stringify({
          mode: 'alpha',
          loggedInAt: new Date().toISOString(),
          user: mockUser,
          account: alphaAccount,
        })
      );
    } catch (error) {
      console.error('[alpha-login] failed to persist mock account', error);
    }

    setGoogleAccount(alphaAccount);
    toast.success('Выполнен вход в режиме Альфа');
    router.replace('/meet' as Href);
  }, [router, setGoogleAccount]);

  const openLegalDocument = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      toast.error('Не удалось открыть юридический документ.');
    }
  }, []);

  const handleConsentRequiredPress = useCallback(() => {
    toast.error(CONSENT_REQUIRED_MESSAGE);
  }, []);

  const handleAlphaPress = useCallback(() => {
    if (!agreedToTerms) {
      handleConsentRequiredPress();
      return;
    }
    void handleAlphaLogin();
  }, [agreedToTerms, handleAlphaLogin, handleConsentRequiredPress]);

  const handleDisabledGooglePress = useCallback(() => {
    if (!agreedToTerms) {
      handleConsentRequiredPress();
      return;
    }
    toast.error(GOOGLE_AUTH_NOT_CONFIGURED_MESSAGE);
  }, [agreedToTerms, handleConsentRequiredPress]);

  if (!isGoogleConfigured) {
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

          <LegalConsentCard
            agreedToTerms={agreedToTerms}
            onOpenPrivacy={() => void openLegalDocument(LEGAL_PRIVACY_URL)}
            onOpenTerms={() => void openLegalDocument(LEGAL_TERMS_URL)}
            onToggleAgreement={() => setAgreedToTerms((prev) => !prev)}
          />

          <View style={styles.googleDisabledButtonWrap}>
            <NeonButton
              disabled
              label="Войти через Google"
              icon={<FontAwesome name="google" size={20} color="#03202A" />}
              style={[styles.googleNeonButton, !agreedToTerms ? styles.dimmedButton : null]}
            />
            <Pressable
              accessibilityLabel="Войти через Google (недоступно)"
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              onPress={handleDisabledGooglePress}
              style={styles.googleDisabledOverlay}
            />
          </View>

          {alphaBypassEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !agreedToTerms }}
              onPress={handleAlphaPress}
              style={[styles.alphaButton, !agreedToTerms ? styles.dimmedButton : null]}>
              <Text style={styles.alphaButtonLabel}>Продолжить без Google (Альфа)</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GoogleLoginReady
      agreedToTerms={agreedToTerms}
      onConsentRequired={handleConsentRequiredPress}
      onOpenPrivacy={() => void openLegalDocument(LEGAL_PRIVACY_URL)}
      onOpenTerms={() => void openLegalDocument(LEGAL_TERMS_URL)}
      onToggleAgreement={() => setAgreedToTerms((prev) => !prev)}
      googleConfig={googleConfig}
      alphaBypassEnabled={alphaBypassEnabled}
      onAlphaBypass={handleAlphaLogin}
    />
  );
}

function GoogleLoginReady({
  agreedToTerms,
  onConsentRequired,
  onOpenPrivacy,
  onOpenTerms,
  onToggleAgreement,
  googleConfig,
  alphaBypassEnabled,
  onAlphaBypass,
}: {
  agreedToTerms: boolean;
  onConsentRequired: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onToggleAgreement: () => void;
  googleConfig: GoogleConfig;
  alphaBypassEnabled: boolean;
  onAlphaBypass: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { setGoogleAccount } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  const handleGoogleLogin = async () => {
    if (!agreedToTerms) {
      onConsentRequired();
      return;
    }

    if (Platform.OS === 'android' && !normalizedEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)) {
      toast.error(GOOGLE_AUTH_NOT_CONFIGURED_MESSAGE);
      return;
    }

    if (!request || isLoadingProfile) {
      return;
    }

    setErrorMessage(null);
    try {
      await promptAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось запустить вход через Google.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === 'error') {
      const message = 'Google авторизация завершилась ошибкой. Попробуйте снова.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (response.type !== 'success') {
      return;
    }

    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      const message = 'Не удалось получить токен Google. Проверьте настройки OAuth.';
      setErrorMessage(message);
      toast.error(message);
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
          const message = 'Google не вернул email. Используйте аккаунт с открытым email.';
          setErrorMessage(message);
          toast.error(message);
          return;
        }
        const message = 'Не удалось получить профиль Google. Проверьте соединение и попробуйте ещё раз.';
        setErrorMessage(message);
        toast.error(message);
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, [response, router, setGoogleAccount]);

  const canLogin = Boolean(request) && !isLoadingProfile;
  const canLoginWithConsent = canLogin && agreedToTerms;
  const handleAlphaPress = () => {
    if (!agreedToTerms) {
      onConsentRequired();
      return;
    }
    void onAlphaBypass();
  };

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

        <LegalConsentCard
          agreedToTerms={agreedToTerms}
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onToggleAgreement={onToggleAgreement}
        />

        <View style={styles.googleButtonWrap}>
          <NeonButton
            disabled={!canLoginWithConsent}
            onPress={handleGoogleLogin}
            label="Войти через Google"
            icon={
              isLoadingProfile ? (
                <ActivityIndicator color="#03202A" />
              ) : (
                <FontAwesome name="google" size={20} color="#03202A" />
              )
            }
            style={[styles.googleNeonButton, !agreedToTerms ? styles.dimmedButton : null]}
          />
          {!agreedToTerms ? (
            <Pressable
              accessibilityLabel="Войти через Google (требуется согласие)"
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              onPress={onConsentRequired}
              style={styles.googleDisabledOverlay}
            />
          ) : null}
        </View>

        {alphaBypassEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !agreedToTerms }}
            onPress={handleAlphaPress}
            style={[styles.alphaButton, !agreedToTerms ? styles.dimmedButton : null]}>
            <Text style={styles.alphaButtonLabel}>Продолжить без Google (Альфа)</Text>
          </Pressable>
        ) : null}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function LegalConsentCard({
  agreedToTerms,
  onToggleAgreement,
  onOpenTerms,
  onOpenPrivacy,
}: {
  agreedToTerms: boolean;
  onToggleAgreement: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}) {
  return (
    <GlassView intensity={26} radius={16} style={styles.consentCard}>
      <View style={styles.consentRow}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreedToTerms }} onPress={onToggleAgreement} style={styles.checkboxPressable}>
        <View style={[styles.checkboxCircle, agreedToTerms ? styles.checkboxCircleActive : null]}>
          {agreedToTerms ? <FontAwesome name="check" size={12} color="#04212A" /> : null}
        </View>
        </Pressable>

        <Text style={styles.consentText}>
          Я прочитал(а) и согласен(на) с{' '}
          <Text onPress={onOpenTerms} style={styles.legalLink}>
            Условиями использования
          </Text>{' '}
          и{' '}
          <Text onPress={onOpenPrivacy} style={styles.legalLink}>
            Политикой конфиденциальности
          </Text>
          .
        </Text>
      </View>
    </GlassView>
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
  consentCard: {
    width: '100%',
    maxWidth: 340,
    borderColor: 'rgba(214, 234, 255, 0.16)',
    backgroundColor: 'rgba(16, 21, 36, 0.56)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxPressable: {
    borderRadius: 11,
    marginTop: 1,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.4,
    borderColor: 'rgba(0, 229, 255, 0.56)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxCircleActive: {
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.44,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  consentText: {
    flex: 1,
    color: premiumPalette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  legalLink: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  googleNeonButton: {
    width: '100%',
    maxWidth: 340,
  },
  googleButtonWrap: {
    width: '100%',
    maxWidth: 340,
    position: 'relative',
  },
  googleDisabledButtonWrap: {
    width: '100%',
    maxWidth: 340,
    position: 'relative',
  },
  googleDisabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  alphaButton: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surfaceElevated,
  },
  dimmedButton: {
    opacity: 0.48,
  },
  alphaButtonLabel: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    marginTop: 8,
    color: '#FF7D7D',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
});
