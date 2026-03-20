import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-context';
import { toast } from '@/src/utils/toast';

import {
  LiquidButton,
  LiquidChipGroup,
  LiquidPage,
  LiquidSection,
  LiquidSlider,
  LiquidSwitchRow,
  liquidColors,
} from './_ui';

export default function ChatsSettingsScreen() {
  const { googleAccount, profile } = useAuth();
  const [theme, setTheme] = useState('Бездна');
  const [wallpaper, setWallpaper] = useState('Стеклянная сетка');
  const [bubbleRadius, setBubbleRadius] = useState(18);
  const [compactMode, setCompactMode] = useState(false);
  const [animatedBackground, setAnimatedBackground] = useState(true);
  const [autoPlayGifs, setAutoPlayGifs] = useState(true);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <LiquidPage back subtitle="Оформление чатов и визуальные эффекты" title="Настройки чатов">
      <LiquidSection
        delay={40}
        description="Выберите визуальную тему и фон по умолчанию для диалогов."
        title="Внешний вид">
        <LiquidChipGroup
          label="Тема интерфейса"
          onChange={setTheme}
          options={['Бездна', 'Северное сияние', 'Золотой неон']}
          value={theme}
        />
        <LiquidChipGroup
          label="Обои по умолчанию"
          onChange={setWallpaper}
          options={['Стеклянная сетка', 'Космический дым', 'Градиент океана']}
          value={wallpaper}
        />
        <LiquidSlider
          formatValue={(value) => `${value}px`}
          label="Скругление пузырей сообщений"
          max={26}
          min={10}
          onChange={setBubbleRadius}
          step={1}
          value={bubbleRadius}
        />
      </LiquidSection>

      <LiquidSection delay={120} title="Поведение чатов">
        <LiquidSwitchRow
          onChange={setCompactMode}
          subtitle="Уменьшенные отступы и плотный список сообщений"
          title="Компактный режим"
          value={compactMode}
        />
        <LiquidSwitchRow
          onChange={setAnimatedBackground}
          subtitle="Плавное движение световых слоев на фоне"
          title="Анимированный фон чатов"
          value={animatedBackground}
        />
        <LiquidSwitchRow
          onChange={setAutoPlayGifs}
          subtitle="Автоматически запускать гиф-анимации и короткие ролики"
          title="Автовоспроизведение анимаций"
          value={autoPlayGifs}
        />
      </LiquidSection>

      <View style={styles.previewWrap}>
        <Text style={styles.previewTitle}>Текущий стиль</Text>
        <Text style={styles.previewText}>
          Тема: {theme} • Обои: {wallpaper} • Радиус пузырей: {bubbleRadius}px
        </Text>
      </View>

      <LiquidButton
        label="Применить оформление"
        onPress={() => toast.success('Новые параметры чатов применены.')}
      />
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.34)',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  previewTitle: {
    color: '#D2FAFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewText: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
