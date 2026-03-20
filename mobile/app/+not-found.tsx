import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Страница не найдена' }} />
      <SafeAreaView style={styles.root}>
        <View pointerEvents="none" style={styles.ambientLayer}>
          <View style={styles.ambientCyan} />
          <View style={styles.ambientIndigo} />
        </View>

        <View style={styles.container}>
          <GlassView intensity={30} radius={22} style={styles.card}>
            <Text style={styles.title}>Эта страница не существует.</Text>
            <Text style={styles.subtitle}>Проверьте ссылку или вернитесь на главный экран MegaConvert.</Text>
            <NeonButton title="Вернуться на главный экран" onPress={() => router.replace('/')} style={styles.backButton} />
          </GlassView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientCyan: {
    position: 'absolute',
    top: -90,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  ambientIndigo: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 4,
    minHeight: 48,
  },
});
