import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';

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

export function AttachmentBottomSheet({
  visible,
  isBusy = false,
  onClose,
  onSelectFileOrGallery,
}: AttachmentBottomSheetProps) {
  const { width } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  const panelTranslateY = useRef(new Animated.Value(320)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const panelWidth = useMemo(() => {
    if (width >= 900) {
      return Math.min(560, width - 72);
    }
    return width - 20;
  }, [width]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(panelTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 230,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!shouldRender) {
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: 300,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShouldRender(false);
      }
    });
  }, [backdropOpacity, panelTranslateY, shouldRender, visible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal transparent statusBarTranslucent onRequestClose={onClose} visible={shouldRender}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              width: panelWidth,
              transform: [{ translateY: panelTranslateY }],
            },
          ]}>
          <View style={styles.dragHandle} />
          <Text style={styles.title}>Вложения</Text>
          <Text style={styles.subtitle}>Выберите инструмент для отправки контента</Text>

          <View style={styles.grid}>
            {actions.map((action) => {
              const disabled = action.disabled || isBusy;
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
                    action.disabled ? styles.actionCardDisabled : null,
                    pressed && !disabled ? styles.actionCardPressed : null,
                  ]}>
                  <View style={styles.iconWrap}>
                    <MaterialIcons name={action.icon} size={24} color={premiumPalette.textPrimary} />
                  </View>
                  <Text style={styles.actionLabel}>{action.title}</Text>
                  {action.disabled ? <Text style={styles.soonBadge}>Скоро</Text> : null}
                </Pressable>
              );
            })}
          </View>
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
    paddingBottom: 14,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 14, 0.64)',
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#233654',
    backgroundColor: '#0A1324',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
    maxWidth: 560,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#324968',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E4E77',
    backgroundColor: '#143763',
    padding: 12,
    justifyContent: 'space-between',
    position: 'relative',
  },
  actionCardDisabled: {
    backgroundColor: '#101A2C',
    borderColor: '#24344F',
  },
  actionCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.93,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: premiumPalette.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  soonBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 999,
    backgroundColor: '#2A3448',
    color: '#AFBDD2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 11,
  },
});
