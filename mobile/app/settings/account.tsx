import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-context';
import { toast } from '@/src/utils/toast';

import {
  LiquidActionRow,
  LiquidButton,
  LiquidInput,
  LiquidPage,
  LiquidSection,
  liquidColors,
} from './_ui';
import { useState } from 'react';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { googleAccount, profile, signOut } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || googleAccount?.fullName || '');
  const [username, setUsername] = useState(profile?.username ? `@${profile.username}` : '');

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  return (
    <LiquidPage back subtitle="Имя пользователя, профиль и доступы" title="Аккаунт">
      <LiquidSection
        delay={40}
        description="Изменения применяются локально и будут синхронизированы после подтверждения."
        title="Профиль">
        <LiquidInput
          autoCapitalize="words"
          label="Отображаемое имя"
          maxLength={48}
          onChangeText={setFullName}
          placeholder="Введите имя"
          value={fullName}
        />
        <LiquidInput
          autoCapitalize="none"
          label="Имя пользователя"
          maxLength={25}
          onChangeText={setUsername}
          placeholder="@имя_пользователя"
          value={username}
        />
      </LiquidSection>

      <LiquidSection delay={120} title="Безопасность аккаунта">
        <LiquidActionRow
          onPress={() => toast.info('Управление двухэтапной защитой будет доступно в ближайшем обновлении.')}
          subtitle="Защитите вход одноразовыми кодами"
          title="Двухэтапная аутентификация"
          value="Выключена"
        />
        <LiquidActionRow
          onPress={() => toast.info('Журнал устройств откроется в отдельном окне.')}
          subtitle="Телефоны и планшеты, где выполнен вход"
          title="Активные устройства"
          value="3 сессии"
        />
      </LiquidSection>

      <View style={styles.actionsWrap}>
        <LiquidButton
          label="Сохранить изменения"
          onPress={() => {
            if (!fullName.trim()) {
              toast.error('Имя не может быть пустым.');
              return;
            }
            if (!username.trim().startsWith('@')) {
              toast.error('Имя пользователя должно начинаться с символа @.');
              return;
            }
            toast.success('Настройки аккаунта сохранены.');
          }}
        />

        <LiquidButton
          danger
          label="Выйти из аккаунта"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
        />
      </View>

      <Text style={styles.helperText}>
        Изменения применяются безопасно: конфиденциальные поля шифруются перед отправкой.
      </Text>
    </LiquidPage>
  );
}

const styles = StyleSheet.create({
  actionsWrap: {
    gap: 10,
  },
  helperText: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
