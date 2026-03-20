import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';

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
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={styles.ambientCyan} />
        <View style={styles.ambientIndigo} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <GlassView intensity={22} radius={20} style={styles.headCard}>
            <Text style={styles.title}>Настройка бизнес-профиля</Text>
            <Text style={styles.subtitle}>
              Заполните профиль. При сохранении автоматически выдадим Pro-статус.
            </Text>
          </GlassView>

          <GlassView intensity={24} radius={20} style={styles.avatarCard}>
            <View style={styles.avatarSection}>
              <Pressable onPress={pickAvatar} style={styles.avatarButton}>
                <View style={styles.avatarSpecular} />
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
          </GlassView>

          <GlassView intensity={24} radius={20} style={styles.inputCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Уникальный @username</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="ascii-capable"
                maxLength={25}
                onChangeText={setUsername}
                placeholder="@ваша_компания"
                placeholderTextColor="#7A8AA4"
                style={styles.input}
                value={username}
              />
              <Text style={styles.inputHint}>Формат: 4-24 символа, латиница, цифры, _.</Text>
            </View>
          </GlassView>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <NeonButton
            title="Сохранить и войти"
            disabled={isSaving}
            onPress={submitProfile}
            icon={isSaving ? <ActivityIndicator color="#03202A" /> : undefined}
            style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientCyan: {
    position: 'absolute',
    top: -120,
    right: -24,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
  },
  ambientIndigo: {
    position: 'absolute',
    bottom: 40,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  keyboardWrap: {
    flex: 1,
  },
  headCard: {
    padding: 16,
    gap: 8,
  },
  title: {
    color: premiumPalette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  avatarCard: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    padding: 4,
    overflow: 'hidden',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarSpecular: {
    position: 'absolute',
    top: 3,
    left: 10,
    right: 10,
    height: 13,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
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
    backgroundColor: 'rgba(16, 16, 26, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarHint: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
  },
  inputCard: {
    padding: 16,
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
    backgroundColor: 'rgba(16, 16, 26, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
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
    marginTop: 2,
    minHeight: 56,
  },
  saveButtonDisabled: {
    opacity: 0.62,
  },
});
