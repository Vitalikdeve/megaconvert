import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { toast } from '@/src/utils/toast';

import {
  LiquidButton,
  LiquidPage,
  LiquidSection,
  LiquidSlider,
  LiquidSwitchRow,
  liquidColors,
} from './_ui';

type StorageBlock = {
  title: string;
  usedMb: number;
  limitMb: number;
};

const STORAGE_BLOCKS: StorageBlock[] = [
  { title: 'Медиа чатов', usedMb: 1240, limitMb: 4096 },
  { title: 'Документы', usedMb: 620, limitMb: 2048 },
  { title: 'Временный кэш', usedMb: 370, limitMb: 1024 },
];

export default function DataSettingsScreen() {
  const { googleAccount, profile } = useAuth();
  const [autoDownloadMedia, setAutoDownloadMedia] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [saveOutgoingMedia, setSaveOutgoingMedia] = useState(false);
  const [cacheLimitMb, setCacheLimitMb] = useState(1536);
  const [uploadQuality, setUploadQuality] = useState(84);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const totalUsed = useMemo(
    () => STORAGE_BLOCKS.reduce((sum, item) => sum + item.usedMb, 0),
    []
  );
  const totalLimit = useMemo(
    () => STORAGE_BLOCKS.reduce((sum, item) => sum + item.limitMb, 0),
    []
  );

  return (
    <LiquidPage back subtitle="Хранилище, автозагрузка и качество медиа" title="Данные и память">
      <LiquidSection
        delay={40}
        description="Параметры передачи данных применяются сразу для мобильной сети и Wi-Fi."
        title="Сетевое поведение">
        <LiquidSwitchRow
          onChange={setAutoDownloadMedia}
          subtitle="Скачивать фото и видео из чатов автоматически"
          title="Автозагрузка медиа"
          value={autoDownloadMedia}
        />
        <LiquidSwitchRow
          onChange={setWifiOnly}
          subtitle="Крупные файлы передавать только через защищенную сеть"
          title="Только защищенная сеть для больших файлов"
          value={wifiOnly}
        />
        <LiquidSwitchRow
          onChange={setSaveOutgoingMedia}
          subtitle="Копировать отправленные фото в память устройства"
          title="Сохранять исходящие медиа"
          value={saveOutgoingMedia}
        />
      </LiquidSection>

      <LiquidSection delay={120} title="Лимиты и оптимизация">
        <LiquidSlider
          formatValue={(value) => `${value} МБ`}
          label="Лимит кэша"
          max={4096}
          min={256}
          onChange={setCacheLimitMb}
          step={64}
          value={cacheLimitMb}
        />
        <LiquidSlider
          formatValue={(value) => `${value}%`}
          label="Качество загрузки фото"
          max={100}
          min={40}
          onChange={setUploadQuality}
          step={2}
          value={uploadQuality}
        />
      </LiquidSection>

      <LiquidSection delay={190} title="Использование памяти">
        <View style={styles.memoryHead}>
          <Text style={styles.memoryTotal}>Использовано: {totalUsed} МБ из {totalLimit} МБ</Text>
          <Text style={styles.memoryHint}>Рекомендация: держать кэш ниже 2 ГБ для стабильной работы.</Text>
        </View>

        <View style={styles.memoryList}>
          {STORAGE_BLOCKS.map((block) => {
            const ratio = Math.min(1, block.usedMb / block.limitMb);
            return (
              <GlassView intensity={18} key={block.title} radius={14} style={styles.memoryCard}>
                <View style={styles.memoryCardHeader}>
                  <Text style={styles.memoryCardTitle}>{block.title}</Text>
                  <Text style={styles.memoryCardValue}>
                    {block.usedMb} / {block.limitMb} МБ
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
                </View>
              </GlassView>
            );
          })}
        </View>
      </LiquidSection>

      <LiquidButton
        label="Очистить временный кэш"
        onPress={() => toast.success('Кэш очищен. Быстрые миниатюры будут загружены заново.')}
      />
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  memoryHead: {
    gap: 4,
  },
  memoryTotal: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  memoryHint: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  memoryList: {
    gap: 8,
  },
  memoryCard: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  memoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  memoryCardTitle: {
    color: liquidColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  memoryCardValue: {
    color: liquidColors.textSecondary,
    fontSize: 11,
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.55)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
});
