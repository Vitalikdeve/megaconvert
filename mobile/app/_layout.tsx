import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/providers/auth-context';
import { ContactsProvider } from '@/providers/contacts-context';
import { premiumDarkTheme, premiumPalette } from '@/constants/theme';
import { appendIncomingMeshMessage } from '@/src/services/chat-message-store';
import MeshSDK from '@/src/services/mesh-sdk';
import { toast } from '@/src/utils/toast';
import { decryptMessage, getOrCreateSharedSecret, type EncryptedPayload } from '@/utils/crypto';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

let typographyApplied = false;
const MESH_API_KEY = process.env.EXPO_PUBLIC_MESH_API_KEY || 'ALPHA_MESH_API_KEY';

function applyGlobalTypography() {
  if (typographyApplied) {
    return;
  }

  const defaultFontFamily = Platform.select({
    android: 'sans-serif',
    ios: 'System',
    default: 'System',
  });

  const textComponent = Text as unknown as { defaultProps?: { style?: unknown } };
  const inputComponent = TextInput as unknown as { defaultProps?: { style?: unknown } };

  textComponent.defaultProps = {
    ...(textComponent.defaultProps || {}),
    style: [
      {
        color: premiumPalette.textPrimary,
        fontFamily: defaultFontFamily,
      },
      textComponent.defaultProps?.style,
    ],
  };

  inputComponent.defaultProps = {
    ...(inputComponent.defaultProps || {}),
    style: [
      {
        color: premiumPalette.textPrimary,
        fontFamily: defaultFontFamily,
      },
      inputComponent.defaultProps?.style,
    ],
  };

  typographyApplied = true;
}

export default function RootLayout() {
  useEffect(() => {
    applyGlobalTypography();
  }, []);

  return (
    <ThemeProvider value={premiumDarkTheme}>
      <AuthProvider>
        <MeshBootstrap />
        <ContactsProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: premiumPalette.surface,
              },
              headerTintColor: premiumPalette.textPrimary,
              headerShadowVisible: false,
              contentStyle: {
                backgroundColor: premiumPalette.background,
              },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="meet" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen
              name="setup-profile"
              options={{
                title: 'Настройка профиля',
                headerBackTitle: 'Назад',
              }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-contact"
              options={{
                title: 'Добавить контакт',
              }}
            />
            <Stack.Screen
              name="chat/[id]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="call"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
        </ContactsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function MeshBootstrap() {
  const { googleAccount, profile } = useAuth();
  const meshUserId = useMemo(
    () => profile?.username || googleAccount?.id || '',
    [googleAccount?.id, profile?.username]
  );

  useEffect(() => {
    if (!meshUserId) {
      return;
    }

    void MeshSDK.init(MESH_API_KEY, meshUserId);
  }, [meshUserId]);

  useEffect(() => {
    return MeshSDK.onMessageReceived((senderId, data) => {
      void (async () => {
        try {
          const encrypted = JSON.parse(String(data || '')) as Partial<EncryptedPayload>;
          if (!encrypted.ciphertext || !encrypted.iv) {
            throw new Error('INVALID_MESH_PAYLOAD');
          }

          const sharedSecret = await getOrCreateSharedSecret(senderId);
          const plainText = await decryptMessage(
            {
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
            },
            sharedSecret
          );

          const normalizedText = plainText.trim();
          if (!normalizedText) {
            return;
          }

          appendIncomingMeshMessage(senderId, normalizedText);
          toast.success('Получено E2EE сообщение по воздуху (Mesh)');
        } catch {
          toast.error('Ошибка E2EE шифрования при Mesh-передаче.');
        }
      })();
    });
  }, []);

  return null;
}
