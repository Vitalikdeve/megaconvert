import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

import { premiumPalette } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerBackground: () => (
          <BlurView
            intensity={58}
            tint="dark"
            style={{ flex: 1, backgroundColor: premiumPalette.glass }}
          />
        ),
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: premiumPalette.textPrimary,
        headerShadowVisible: false,
        tabBarBackground: () => (
          <BlurView
            intensity={64}
            tint="dark"
            style={{ flex: 1, backgroundColor: premiumPalette.glassHeavy }}
          />
        ),
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: premiumPalette.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: premiumPalette.accent,
        tabBarInactiveTintColor: premiumPalette.textSecondary,
      }}>
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Контакты',
          tabBarLabel: 'Контакты',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="groups" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
