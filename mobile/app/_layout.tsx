import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/providers/auth-context';
import { ContactsProvider } from '@/providers/contacts-context';
import { premiumDarkTheme, premiumPalette } from '@/constants/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={premiumDarkTheme}>
      <AuthProvider>
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
