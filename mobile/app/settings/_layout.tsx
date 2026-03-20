import { Stack } from 'expo-router';

import { liquidColors } from './_ui';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: liquidColors.deepSpaceBlack,
        },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="data" />
      <Stack.Screen name="chats" />
      <Stack.Screen name="premium" />
    </Stack>
  );
}
