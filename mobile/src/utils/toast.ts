import { Alert, Platform, ToastAndroid } from 'react-native';

type ToastKind = 'error' | 'info' | 'success';

const TOAST_TITLES: Record<ToastKind, string> = {
  error: 'Ошибка',
  info: 'Информация',
  success: 'Готово',
};

function resolveMessage(input: unknown, fallback: string): string {
  if (typeof input === 'string') {
    const normalized = input.trim();
    return normalized || fallback;
  }

  if (input instanceof Error) {
    const normalized = input.message.trim();
    return normalized || fallback;
  }

  return fallback;
}

function show(kind: ToastKind, message: unknown, fallback: string) {
  const text = resolveMessage(message, fallback);
  if (Platform.OS === 'android') {
    ToastAndroid.show(text, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(TOAST_TITLES[kind], text);
}

export const toast = {
  error: (message: unknown) => show('error', message, 'Произошла ошибка'),
  info: (message: unknown) => show('info', message, 'Обновлено'),
  success: (message: unknown) => show('success', message, 'Успешно'),
};
