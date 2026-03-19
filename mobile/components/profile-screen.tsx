import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';

export function ProfileScreen() {
  const router = useRouter();
  const { googleAccount, profile, signOut } = useAuth();

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <View style={styles.card}>
          {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.logoWrapper}>
              <BrandLogo size={88} />
            </View>
          )}

          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.fullName}</Text>
            {profile.isPro ? (
              <MaterialIcons name="verified" size={20} color={premiumPalette.accent} />
            ) : null}
          </View>

          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.email}>{profile.email}</Text>

          {profile.isPro ? <Text style={styles.proBadge}>MegaConvert Pro</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
          style={({ pressed }) => [styles.outlineButton, pressed ? styles.outlineButtonPressed : null]}>
          <Text style={styles.outlineButtonLabel}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  card: {
    marginTop: 10,
    backgroundColor: premiumPalette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  name: {
    color: premiumPalette.textPrimary,
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  username: {
    color: premiumPalette.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
  },
  proBadge: {
    marginTop: 6,
    backgroundColor: '#11315E',
    color: '#8CC1FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  outlineButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  outlineButtonPressed: {
    opacity: 0.9,
  },
  outlineButtonLabel: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
