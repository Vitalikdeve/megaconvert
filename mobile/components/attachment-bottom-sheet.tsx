import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { premiumPalette } from '@/constants/theme';
import { GlassView } from '@/src/components/ui/GlassView';

type AttachmentBottomSheetProps = {
  visible: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onSelectFileOrGallery: () => void;
};

type AttachmentAction = {
  key: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  disabled: boolean;
};

const actions: AttachmentAction[] = [
  {
    key: 'file-gallery',
    title: 'Файл/Галерея',
    icon: 'folder-open',
    disabled: false,
  },
  {
    key: 'converter',
    title: 'Конвертер файлов',
    icon: 'sync-alt',
    disabled: true,
  },
  {
    key: 'compress',
    title: 'Сжатие видео',
    icon: 'video-file',
    disabled: true,
  },
  {
    key: 'photo-ai',
    title: 'AI Фотогенерация',
    icon: 'auto-awesome',
    disabled: true,
  },
  {
    key: 'stickers',
    title: 'Генератор стикеров',
    icon: 'style',
    disabled: true,
  },
];

const liquidEase = Easing.bezier(0.23, 1, 0.32, 1);

export function AttachmentBottomSheet({
  visible,
  isBusy = false,
  onClose,
  onSelectFileOrGallery,
}: AttachmentBottomSheetProps) {
  const { width } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  const progress = useSharedValue(0);

  const panelWidth = useMemo(() => {
    if (width >= 900) {
      return Math.min(560, width - 72);
    }
    return width - 20;
  }, [width]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      progress.value = withTiming(1, {
        duration: 360,
        easing: liquidEase,
      });
      return;
    }

    if (!shouldRender) {
      return;
    }

    progress.value = withTiming(
      0,
      {
        duration: 260,
        easing: liquidEase,
      },
      (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      }
    );
  }, [progress, shouldRender, visible]);

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
    };
  });

  const panelAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.94 + progress.value * 0.06,
      transform: [{ translateY: (1 - progress.value) * 320 }],
    };
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal transparent statusBarTranslucent onRequestClose={onClose} visible={shouldRender}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View
          style={[
            {
              width: panelWidth,
            },
            panelAnimatedStyle,
          ]}>
          <GlassView intensity={24} radius={28} style={styles.sheetGlass}>
            <View style={styles.sheetContent}>
              <View style={styles.dragHandle} />
              <Text style={styles.title}>Вложения</Text>
              <Text style={styles.subtitle}>Выберите инструмент для отправки контента</Text>

              <View style={styles.grid}>
                {actions.map((action) => {
                  const disabled = action.disabled || isBusy;
                  const isPrimary = action.key === 'file-gallery';

                  return (
                    <Pressable
                      key={action.key}
                      disabled={disabled}
                      onPress={() => {
                        if (action.key === 'file-gallery') {
                          onSelectFileOrGallery();
                        }
                      }}
                      style={({ pressed }) => [
                        styles.actionCard,
                        isPrimary ? styles.actionCardPrimary : null,
                        action.disabled ? styles.actionCardDisabled : null,
                        pressed && !disabled ? styles.actionCardPressed : null,
                      ]}>
                      <View style={[styles.iconWrap, isPrimary ? styles.iconWrapPrimary : null]}>
                        <MaterialIcons
                          name={action.icon}
                          size={24}
                          color={
                            action.disabled
                              ? '#92A0B5'
                              : isPrimary
                                ? premiumPalette.accent
                                : premiumPalette.textPrimary
                          }
                        />
                      </View>
                      <Text style={[styles.actionLabel, action.disabled ? styles.actionLabelDisabled : null]}>
                        {action.title}
                      </Text>
                      {action.disabled ? (
                        <View style={styles.soonBadge}>
                          <Text style={styles.soonBadgeText}>Скоро</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </GlassView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 9, 0.56)',
  },
  sheetGlass: {
    maxWidth: 560,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.34)',
    marginBottom: 6,
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48.5%',
    minHeight: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.22)',
    backgroundColor: 'rgba(16, 16, 26, 0.54)',
    padding: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  actionCardPrimary: {
    borderColor: 'rgba(0, 229, 255, 0.42)',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  actionCardDisabled: {
    backgroundColor: 'rgba(16, 16, 26, 0.56)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  actionCardPressed: {
    transform: [{ scale: 0.982 }],
    opacity: 0.92,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(226, 232, 240, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.16)',
  },
  iconWrapPrimary: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.46)',
  },
  actionLabel: {
    color: premiumPalette.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  actionLabelDisabled: {
    color: '#CAD5E4',
  },
  soonBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.38)',
    backgroundColor: 'rgba(71, 85, 105, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    shadowColor: premiumPalette.indigo,
    shadowOpacity: 0.34,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  soonBadgeText: {
    color: '#D8DEFF',
    fontWeight: '700',
    fontSize: 11,
  },
});
