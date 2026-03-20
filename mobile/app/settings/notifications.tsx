import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/providers/auth-context';
import { toast } from '@/src/utils/toast';

import {
  LiquidButton,
  LiquidPage,
  LiquidSection,
  LiquidSlider,
  LiquidSwitchRow,
  liquidColors,
} from './_ui';

export default function NotificationsSettingsScreen() {
  const { googleAccount, profile } = useAuth();
  const [messagePushEnabled, setMessagePushEnabled] = useState(true);
  const [callPushEnabled, setCallPushEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showPreviewEnabled, setShowPreviewEnabled] = useState(false);
  const [volumeValue, setVolumeValue] = useState(74);
  const [quietStartHour, setQuietStartHour] = useState(23);
  const [quietEndHour, setQuietEndHour] = useState(7);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <LiquidPage back subtitle="Пуши, звуки, вибрации и режим тишины" title="Уведомления и звуки">
      <LiquidSection
        delay={40}
        description="Эти параметры влияют на локальные уведомления устройства и входящие вызовы."
        title="Основные уведомления">
        <LiquidSwitchRow
          onChange={setMessagePushEnabled}
          subtitle="Уведомлять о новых сообщениях и реакциях"
          title="Сообщения"
          value={messagePushEnabled}
        />
        <LiquidSwitchRow
          onChange={setCallPushEnabled}
          subtitle="Показывать входящий экран вызова поверх приложения"
          title="Звонки"
          value={callPushEnabled}
        />
        <LiquidSwitchRow
          onChange={setVibrationEnabled}
          subtitle="Короткая вибрация для входящих событий"
          title="Вибрация"
          value={vibrationEnabled}
        />
        <LiquidSwitchRow
          onChange={setShowPreviewEnabled}
          subtitle="Текст сообщения в пуш-предпросмотре"
          title="Показывать текст сообщений"
          value={showPreviewEnabled}
        />
      </LiquidSection>

      <LiquidSection delay={120} title="Звук и тихие часы">
        <LiquidSlider
          formatValue={(value) => `${value}%`}
          label="Громкость уведомлений"
          max={100}
          min={0}
          onChange={setVolumeValue}
          value={volumeValue}
        />
        <LiquidSlider
          formatValue={(value) => `${value}:00`}
          label="Начало тихого режима"
          max={23}
          min={0}
          onChange={setQuietStartHour}
          step={1}
          value={quietStartHour}
        />
        <LiquidSlider
          formatValue={(value) => `${value}:00`}
          label="Окончание тихого режима"
          max={23}
          min={0}
          onChange={setQuietEndHour}
          step={1}
          value={quietEndHour}
        />
      </LiquidSection>

      <LiquidButton
        label="Применить настройки звука"
        onPress={() => {
          toast.success(
            `Сохранено: громкость ${volumeValue}%, тишина с ${quietStartHour}:00 до ${quietEndHour}:00.`
          );
        }}
      />

      <Text style={styles.note}>
        Из-за системных ограничений устройства часть настроек может требовать дополнительного разрешения.
      </Text>
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  note: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
