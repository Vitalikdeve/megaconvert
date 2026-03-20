import { MaterialIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { toast } from '@/src/utils/toast';

import {
  LiquidActionRow,
  LiquidChipGroup,
  LiquidPage,
  LiquidSection,
  LiquidSwitchRow,
  liquidColors,
} from './_ui';

const SESSION_ITEMS = [
  {
    id: 's1',
    device: 'Смартфон',
    location: 'Минск',
    lastSeen: 'Сейчас онлайн',
    fingerprint: 'A8:F4:22:7C:90:DE',
    verified: true,
  },
  {
    id: 's2',
    device: 'Планшет',
    location: 'Варшава',
    lastSeen: 'Сегодня, 09:12',
    fingerprint: '3B:71:C8:E1:4F:0A',
    verified: true,
  },
  {
    id: 's3',
    device: 'Рабочий компьютер',
    location: 'Вильнюс',
    lastSeen: 'Вчера, 22:41',
    fingerprint: '6D:11:9A:FE:2B:34',
    verified: false,
  },
];

const PRIVACY_POLICY_URL = 'https://megaconvert.com/privacy';

export default function PrivacySettingsScreen() {
  const { googleAccount, profile } = useAuth();
  const [statusVisibility, setStatusVisibility] = useState('Контакты');
  const [photoVisibility, setPhotoVisibility] = useState('Контакты');
  const [callVisibility, setCallVisibility] = useState('Все');
  const [syncKeyAlerts, setSyncKeyAlerts] = useState(true);
  const [strictKeyCheck, setStrictKeyCheck] = useState(true);

  const handleOpenPrivacyPolicy = async () => {
    try {
      await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
    } catch {
      toast.error('Не удалось открыть политику конфиденциальности.');
    }
  };

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <LiquidPage back subtitle="Видимость, звонки и E2EE-ключи" title="Конфиденциальность">
      <LiquidSection
        delay={40}
        description="Управляйте тем, кто видит ваш статус, фото профиля и может инициировать звонок."
        title="Видимость профиля">
        <LiquidChipGroup
          label="Кто видит статус «в сети»"
          onChange={setStatusVisibility}
          options={['Все', 'Контакты', 'Никто']}
          value={statusVisibility}
        />
        <LiquidChipGroup
          label="Кто видит фото профиля"
          onChange={setPhotoVisibility}
          options={['Все', 'Контакты', 'Только избранные']}
          value={photoVisibility}
        />
        <LiquidChipGroup
          label="Кто может звонить"
          onChange={setCallVisibility}
          options={['Все', 'Контакты', 'Никто']}
          value={callVisibility}
        />
      </LiquidSection>

      <LiquidSection
        delay={120}
        description="Контроль шифрования end-to-end и проверка сессий по отпечаткам ключей."
        title="Ключи E2EE">
        <LiquidSwitchRow
          onChange={setSyncKeyAlerts}
          subtitle="Предупреждать о смене ключа у собеседника"
          title="Уведомления о смене ключа"
          value={syncKeyAlerts}
        />
        <LiquidSwitchRow
          onChange={setStrictKeyCheck}
          subtitle="Блокировать отправку сообщений до ручной проверки"
          title="Строгая проверка отпечатка"
          value={strictKeyCheck}
        />

        <View style={styles.sessionList}>
          {SESSION_ITEMS.map((session, index) => (
            <Animated.View entering={FadeInDown.delay(170 + index * 50).duration(420)} key={session.id}>
              <GlassView intensity={20} radius={14} style={styles.sessionCard}>
                <View style={styles.sessionHead}>
                  <View style={styles.sessionDeviceWrap}>
                    <Text style={styles.sessionDevice}>{session.device}</Text>
                    <Text style={styles.sessionMeta}>
                      {session.location} • {session.lastSeen}
                    </Text>
                  </View>
                  <View style={[styles.sessionBadge, session.verified ? styles.sessionBadgeOk : styles.sessionBadgeWarn]}>
                    <MaterialIcons
                      color={session.verified ? '#CCFAFF' : '#FFE8D2'}
                      name={session.verified ? 'verified-user' : 'warning-amber'}
                      size={14}
                    />
                  </View>
                </View>
                <Text style={styles.sessionFingerprint}>Отпечаток: {session.fingerprint}</Text>
              </GlassView>
            </Animated.View>
          ))}
        </View>

        <LiquidActionRow
          onPress={() => toast.info('Механизм сброса ключей будет доступен после финальной валидации.')}
          subtitle="Будет создан новый набор ключей для всех чатов"
          title="Сбросить все ключи"
          value="Высокий риск"
        />
      </LiquidSection>

      <LiquidSection
        delay={190}
        description="Официальный юридический документ на веб-портале MegaConvert."
        title="Юридические документы">
        <Animated.View entering={FadeInDown.delay(220).duration(420)}>
          <Pressable accessibilityRole="button" onPress={handleOpenPrivacyPolicy} style={({ pressed }) => [pressed ? styles.pressed : null]}>
            <GlassView intensity={22} radius={14} style={styles.legalCard}>
              <View style={styles.legalTextWrap}>
                <Text style={styles.legalTitle}>Политика конфиденциальности</Text>
                <Text style={styles.legalSubtitle}>Открыть в системном браузере</Text>
              </View>
              <MaterialIcons color={liquidColors.electricCyan} name="open-in-new" size={20} />
            </GlassView>
          </Pressable>
        </Animated.View>
      </LiquidSection>
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  sessionList: {
    gap: 8,
  },
  sessionCard: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  sessionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionDeviceWrap: {
    flex: 1,
    gap: 2,
  },
  sessionDevice: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionMeta: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  sessionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sessionBadgeOk: {
    borderColor: 'rgba(0, 229, 255, 0.5)',
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  sessionBadgeWarn: {
    borderColor: 'rgba(246, 197, 106, 0.62)',
    backgroundColor: 'rgba(246, 197, 106, 0.24)',
  },
  sessionFingerprint: {
    color: '#B6CAE6',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  legalCard: {
    minHeight: 56,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 10,
  },
  legalTextWrap: {
    flex: 1,
    gap: 2,
  },
  legalTitle: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  legalSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.93,
  },
});
