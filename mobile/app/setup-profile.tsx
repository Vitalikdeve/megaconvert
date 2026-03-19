import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';

function getDefaultUsername(email: string): string {
  const localPart = email.split('@')[0] || 'business_user';
  return localPart.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function resolveSaveErrorMessage(code: string): string {
  switch (code) {
    case 'USERNAME_INVALID':
      return 'Имя пользователя должно содержать 4-24 символа: латиница, цифры и _.';
    case 'USERNAME_TAKEN':
      return 'Этот username уже занят. Выберите другой.';
    case 'NOT_AUTHENTICATED':
      return 'Сначала выполните вход через Google.';
    default:
      return 'Не удалось сохранить профиль. Повторите попытку.';
  }
}

export default function SetupProfileScreen() {
  const router = useRouter();
  const { googleAccount, completeProfile } = useAuth();

  const [avatarUri, setAvatarUri] = useState<string | null>(googleAccount?.avatarUri ?? null);
  const initialUsername = useMemo(
    () => `@${googleAccount ? getDefaultUsername(googleAccount.email) : ''}`,
    [googleAccount]
  );
  const [username, setUsername] = useState(initialUsername);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Доступ к фото закрыт',
        'Разрешите доступ к медиатеке, чтобы загрузить аватар компании.'
      );
      return;
    }

    const imageResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (imageResult.canceled || !imageResult.assets[0]) {
      return;
    }

    setAvatarUri(imageResult.assets[0].uri);
  };

  const submitProfile = async () => {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await completeProfile({
        username,
        avatarUri,
      });
      router.replace('/(tabs)/contacts');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROFILE_SAVE_FAILED';
      setErrorMessage(resolveSaveErrorMessage(code));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Настройка бизнес-профиля</Text>
        <Text style={styles.subtitle}>
          Заполните профиль. При сохранении автоматически выдадим Pro-статус.
        </Text>

        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarButton}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="business-center" size={34} color={premiumPalette.accent} />
              </View>
            )}
          </Pressable>
          <Text style={styles.avatarHint}>Нажмите, чтобы загрузить аватар</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Уникальный @username</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="ascii-capable"
            maxLength={25}
            onChangeText={setUsername}
            placeholder="@ваша_компания"
            placeholderTextColor="#708099"
            style={styles.input}
            value={username}
          />
          <Text style={styles.inputHint}>Формат: 4-24 символа, латиница, цифры, _.</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={submitProfile}
          style={({ pressed }) => [styles.saveButton, pressed ? styles.saveButtonPressed : null]}>
          {isSaving ? (
            <ActivityIndicator color={premiumPalette.textPrimary} />
          ) : (
            <Text style={styles.saveButtonLabel}>Сохранить профиль</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 22,
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  avatarSection: {
    marginTop: 10,
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    borderRadius: 52,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surfaceElevated,
    padding: 4,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#111B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    backgroundColor: premiumPalette.surface,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: premiumPalette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  inputHint: {
    color: premiumPalette.textSecondary,
    fontSize: 12,
  },
  error: {
    color: '#FF7D7D',
    fontSize: 13,
  },
  saveButton: {
    marginTop: 6,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.accentStrong,
    borderWidth: 1,
    borderColor: '#318FFF',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonLabel: {
    color: premiumPalette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
});
