import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';

export default function CallScreenWeb() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <GlassView intensity={28} radius={22} style={styles.card}>
        <MaterialIcons name="desktop-access-disabled" size={30} color={premiumPalette.textSecondary} />
        <Text style={styles.title}>Звонки недоступны в web</Text>
        <Text style={styles.body}>Откройте приложение на Android APK или Development Build для теста WebRTC.</Text>
        <NeonButton title="Назад" onPress={() => router.back()} style={styles.backButton} />
      </GlassView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 6,
    minHeight: 46,
    minWidth: 140,
    paddingHorizontal: 20,
  },
});
