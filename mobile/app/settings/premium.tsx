import { MaterialIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { toast } from '@/src/utils/toast';

import { LiquidButton, LiquidPage, LiquidSection, liquidColors } from './_ui';

const PREMIUM_FEATURES = [
  'Синяя галочка Liquid Gold и приоритет в поиске',
  'Расширенные настройки приватности и E2EE-аудит сессий',
  'Звонки сверхвысокой четкости до 4K на совместимых устройствах',
  'Расширенное облачное хранилище и история медиа',
  'Премиальные темы, обои и фирменные наборы иконок',
];

export default function PremiumSettingsScreen() {
  const { googleAccount, profile } = useAuth();

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <LiquidPage back subtitle="Статус подписки и преимущества" title="MegaConvert Премиум">
      <Animated.View entering={FadeInDown.delay(40).duration(420)}>
        <GlassView intensity={34} radius={24} style={styles.heroCard}>
          <View style={styles.heroHead}>
            <View style={styles.heroIconWrap}>
              <MaterialIcons color={liquidColors.electricCyan} name="verified" size={26} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle}>Премиум «Liquid Gold»</Text>
              <Text style={styles.heroSubtitle}>
                Профиль с приоритетом, фирменной галочкой и расширенными возможностями связи.
              </Text>
            </View>
          </View>

          <View style={styles.planRow}>
            <Text style={styles.planCaption}>Текущий план</Text>
            <Text style={styles.planValue}>{profile.isPro ? 'Премиум активен' : 'Базовый тариф'}</Text>
          </View>
          <View style={styles.planRow}>
            <Text style={styles.planCaption}>Следующее списание</Text>
            <Text style={styles.planValue}>{profile.isPro ? '12 апреля 2026' : 'Подписка не подключена'}</Text>
          </View>
        </GlassView>
      </Animated.View>

      <LiquidSection
        delay={120}
        description="Преимущества доступны сразу после активации и привязываются к вашему аккаунту."
        title="Что входит в Premium">
        <View style={styles.featureList}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <Animated.View entering={FadeInDown.delay(140 + index * 45).duration(380)} key={feature}>
              <View style={styles.featureRow}>
                <View style={styles.featureBullet}>
                  <MaterialIcons color={liquidColors.electricCyan} name="check" size={14} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </LiquidSection>

      <LiquidButton
        label={profile.isPro ? 'Управлять подпиской' : 'Подключить Премиум'}
        onPress={() => {
          if (profile.isPro) {
            toast.info('Откроем управление подпиской после интеграции платежного кабинета.');
            return;
          }
          toast.success('Запрос на подключение Premium отправлен.');
        }}
      />

      <LiquidButton
        danger
        label="Сравнить тарифы"
        onPress={() => toast.info('Таблица тарифов появится в следующем обновлении приложения.')}
      />
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderColor: 'rgba(246, 197, 106, 0.46)',
    backgroundColor: 'rgba(24, 18, 8, 0.52)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    shadowColor: liquidColors.gold,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246, 197, 106, 0.64)',
    backgroundColor: 'rgba(246, 197, 106, 0.2)',
  },
  heroMeta: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    color: '#FFE4B1',
    fontSize: 19,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#DBC9A2',
    fontSize: 12,
    lineHeight: 18,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(246, 197, 106, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  planCaption: {
    color: '#E8D7B5',
    fontSize: 12,
  },
  planValue: {
    color: '#FFF1D0',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  featureList: {
    gap: 7,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureBullet: {
    marginTop: 1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.46)',
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
  },
  featureText: {
    flex: 1,
    color: liquidColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
