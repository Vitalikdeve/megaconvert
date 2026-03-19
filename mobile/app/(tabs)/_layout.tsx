import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { premiumPalette } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: premiumPalette.surface,
        },
        headerTintColor: premiumPalette.textPrimary,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: premiumPalette.surface,
          borderTopColor: premiumPalette.border,
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
