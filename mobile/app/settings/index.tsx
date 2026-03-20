import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { toast } from '@/src/utils/toast';

import {
  LiquidButton,
  LiquidPage,
  LiquidSettingsTile,
  liquidColors,
} from './_ui';

const SETTINGS_SECTIONS: Array<{
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href: Href;
}> = [
  {
    title: 'Аккаунт',
    subtitle: 'Имя, имя пользователя и активные устройства',
    icon: 'manage-accounts',
    href: '/settings/account' as Href,
  },
  {
    title: 'Конфиденциальность',
    subtitle: 'Видимость статуса, фото, звонков и E2EE-сессии',
    icon: 'lock-outline',
    href: '/settings/privacy' as Href,
  },
  {
    title: 'Уведомления и звуки',
    subtitle: 'Сигналы, вибрации, тихий режим и предпросмотр',
    icon: 'notifications-none',
    href: '/settings/notifications' as Href,
  },
  {
    title: 'Данные и память',
    subtitle: 'Кэш, автозагрузка и управление хранилищем',
    icon: 'data-usage',
    href: '/settings/data' as Href,
  },
  {
    title: 'Настройки чатов',
    subtitle: 'Темы, обои, пузыри и читаемость переписок',
    icon: 'forum',
    href: '/settings/chats' as Href,
  },
  {
    title: 'MegaConvert Премиум',
    subtitle: 'Статус подписки, преимущества и управление',
    icon: 'workspace-premium',
    href: '/settings/premium' as Href,
  },
];

const LEGAL_SECURITY_ITEMS: Array<{
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  url: string;
}> = [
  {
    title: 'Условия использования (ToS)',
    subtitle: 'Правила платформы и допустимое использование',
    icon: 'description',
    url: 'https://megaconvert.com/legal/terms',
  },
  {
    title: 'Политика конфиденциальности',
    subtitle: 'Сбор метаданных, E2EE и Zero-Access модель',
    icon: 'privacy-tip',
    url: 'https://megaconvert.com/legal/privacy',
  },
  {
    title: 'Запросы правоохранительных органов',
    subtitle: 'Порядок обработки юридических требований',
    icon: 'gavel',
    url: 'https://megaconvert.com/legal/law-enforcement',
  },
  {
    title: 'Отчет о прозрачности',
    subtitle: 'Периодическая отчетность по обращениям и блокировкам',
    icon: 'summarize',
    url: 'https://megaconvert.com/legal/transparency',
  },
];

const DELETE_WARNING_TEXT =
  'Вы уверены? Это действие необратимо удалит ваши метаданные. Зашифрованные сообщения на устройствах собеседников сохранятся.';

function getDefaultUsername(email: string): string {
  const localPart = String(email || '')
    .split('@')[0]
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '');
  return localPart || 'megaconvert_user';
}

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { googleAccount, profile, signOut } = useAuth();

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const displayName = profile.fullName || googleAccount.fullName || 'Пользователь';
  const username = `@${profile.username || getDefaultUsername(profile.email || googleAccount.email)}`;
  const email = profile.email || googleAccount.email || '';
  const isPro = profile.isPro;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');

  const openLegalDocument = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      toast.error('Не удалось открыть юридический документ.');
    }
  };

  const handleDeleteAccountPress = () => {
    Alert.alert('Удаление аккаунта', DELETE_WARNING_TEXT, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Продолжить',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Подтверждение удаления', DELETE_WARNING_TEXT, [
            { text: 'Назад', style: 'cancel' },
            {
              text: 'Удалить аккаунт',
              style: 'destructive',
              onPress: () => {
                toast.info('Запрос на удаление аккаунта зафиксирован.');
              },
            },
          ]);
        },
      },
    ]);
  };

  return (
    <LiquidPage subtitle="Центр управления MegaConvert" title="Настройки">
      <Animated.View entering={FadeInDown.delay(70).duration(430)}>
        <GlassView intensity={30} radius={22} style={styles.heroGlass}>
          <View style={styles.heroTop}>
            <View style={styles.avatarRing}>
              {profile.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials || 'MC'}</Text>
                </View>
              )}
            </View>

            <View style={styles.heroMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.heroName}>{displayName}</Text>
                {isPro ? (
                  <View style={styles.verifiedWrap}>
                    <MaterialIcons color={liquidColors.electricCyan} name="verified" size={16} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.heroUsername}>{username}</Text>
              <Text style={styles.heroEmail}>{email}</Text>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.statusChip}>
              <MaterialIcons color={liquidColors.gold} name="workspace-premium" size={15} />
              <Text style={styles.statusChipLabel}>{isPro ? 'Премиум активен' : 'Базовый доступ'}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/settings/premium' as Href)}
              style={({ pressed }) => [styles.premiumLink, pressed ? styles.pressed : null]}>
              <Text style={styles.premiumLinkLabel}>Управлять подпиской</Text>
              <MaterialIcons color={liquidColors.electricCyan} name="chevron-right" size={18} />
            </Pressable>
          </View>
        </GlassView>
      </Animated.View>

      <View style={styles.tilesWrap}>
        {SETTINGS_SECTIONS.map((section, index) => (
          <LiquidSettingsTile
            delayIndex={index}
            href={section.href}
            icon={section.icon}
            key={section.title}
            subtitle={section.subtitle}
            title={section.title}
          />
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(360).duration(430)}>
        <GlassView intensity={26} radius={20} style={styles.legalGlass}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>Право и безопасность</Text>
            <Text style={styles.legalSubtitle}>Официальные документы MegaConvert</Text>
          </View>

          <View style={styles.legalList}>
            {LEGAL_SECURITY_ITEMS.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.title}
                onPress={() => {
                  void openLegalDocument(item.url);
                }}
                style={({ pressed }) => [styles.legalRow, pressed ? styles.pressed : null]}>
                <View style={styles.legalRowLeading}>
                  <View style={styles.legalRowIconWrap}>
                    <MaterialIcons color={liquidColors.electricCyan} name={item.icon} size={18} />
                  </View>
                  <View style={styles.legalRowTextWrap}>
                    <Text style={styles.legalRowTitle}>{item.title}</Text>
                    <Text style={styles.legalRowSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <MaterialIcons color={liquidColors.textSecondary} name="open-in-new" size={18} />
              </Pressable>
            ))}
          </View>
        </GlassView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(430).duration(430)}>
        <LiquidButton
          danger
          label="Выйти из аккаунта"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(430)}>
        <GlassView intensity={26} radius={20} style={styles.dangerGlass}>
          <Text style={styles.dangerTitle}>Опасная зона</Text>
          <Text style={styles.dangerSubtitle}>Действия, влияющие на аккаунт и персональные метаданные.</Text>

          <Pressable
            accessibilityRole="button"
            onPress={handleDeleteAccountPress}
            style={({ pressed }) => [styles.dangerAction, pressed ? styles.pressed : null]}>
            <MaterialIcons color="#FFDDE1" name="delete-forever" size={18} />
            <Text style={styles.dangerActionLabel}>Удалить аккаунт и стереть данные</Text>
          </Pressable>
        </GlassView>
      </Animated.View>
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  heroGlass: {
    borderColor: liquidColors.border,
    backgroundColor: 'rgba(15, 18, 29, 0.66)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    borderRadius: 34,
    borderWidth: 1.2,
    borderColor: 'rgba(0, 229, 255, 0.46)',
    padding: 3,
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  avatarInitials: {
    color: '#D7FCFF',
    fontSize: 18,
    fontWeight: '800',
  },
  heroMeta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroName: {
    color: liquidColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  verifiedWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246, 197, 106, 0.72)',
    backgroundColor: 'rgba(246, 197, 106, 0.22)',
    shadowColor: liquidColors.gold,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  heroUsername: {
    color: '#C6D8F3',
    fontSize: 14,
    fontWeight: '700',
  },
  heroEmail: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(246, 197, 106, 0.46)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(246, 197, 106, 0.12)',
  },
  statusChipLabel: {
    color: '#FFE7B8',
    fontSize: 12,
    fontWeight: '700',
  },
  premiumLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumLinkLabel: {
    color: '#CEFBFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tilesWrap: {
    gap: 10,
  },
  legalGlass: {
    borderColor: liquidColors.border,
    backgroundColor: 'rgba(15, 18, 29, 0.62)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  legalHeader: {
    gap: 3,
  },
  legalTitle: {
    color: liquidColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  legalSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  legalList: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  legalRow: {
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  legalRowLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legalRowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.36)',
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalRowTextWrap: {
    flex: 1,
    gap: 1,
  },
  legalRowTitle: {
    color: liquidColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  legalRowSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 11,
  },
  dangerGlass: {
    borderColor: 'rgba(255, 110, 124, 0.42)',
    backgroundColor: 'rgba(45, 16, 22, 0.44)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  dangerTitle: {
    color: '#FFC7CF',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerSubtitle: {
    color: '#E1A8AF',
    fontSize: 12,
    lineHeight: 18,
  },
  dangerAction: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 109, 0.56)',
    backgroundColor: 'rgba(255, 77, 91, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF4D5B',
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dangerActionLabel: {
    color: '#FFE6E9',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.92,
  },
});
