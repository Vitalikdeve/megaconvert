import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { AttachmentBottomSheet } from '@/components/attachment-bottom-sheet';
import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { useContacts } from '@/providers/contacts-context';

type ChatMessage = {
  id: string;
  sender: 'me' | 'contact';
  kind: 'text' | 'file';
  text: string;
  createdAt: string;
};

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInitialMessages(contactName: string): ChatMessage[] {
  return [
    {
      id: 'm3',
      sender: 'contact',
      kind: 'text',
      text: 'Отлично, ждём финальный прайс.',
      createdAt: '2026-03-19T10:12:00.000Z',
    },
    {
      id: 'm2',
      sender: 'me',
      kind: 'text',
      text: 'Подготовили КП. Отправлю PDF после согласования.',
      createdAt: '2026-03-19T10:08:00.000Z',
    },
    {
      id: 'm1',
      sender: 'contact',
      kind: 'text',
      text: `Здравствуйте! ${contactName}, готовы обсудить условия интеграции?`,
      createdAt: '2026-03-19T10:04:00.000Z',
    },
  ];
}

function buildMessage(idPrefix: string, text: string, kind: 'text' | 'file'): ChatMessage {
  return {
    id: `${idPrefix}-${Date.now()}`,
    sender: 'me',
    kind,
    text,
    createdAt: new Date().toISOString(),
  };
}

function normalizeChatId(rawParam: string | string[] | undefined): string {
  if (!rawParam) {
    return 'unknown';
  }
  if (Array.isArray(rawParam)) {
    return rawParam[0] ?? 'unknown';
  }
  return rawParam;
}

function normalizeRoomToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 48);
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const { googleAccount, profile } = useAuth();
  const { contacts } = useContacts();

  const chatId = normalizeChatId(params.id);

  const chatContact = useMemo(
    () => contacts.find((item) => item.id === chatId || item.username === chatId) ?? null,
    [chatId, contacts]
  );

  const contactName = chatContact?.fullName ?? `@${chatId}`;
  const contactAvatarLetter = contactName.slice(0, 1).toUpperCase();
  const isProContact = chatContact?.isPro ?? true;
  const roomIdForCall = useMemo(() => {
    const me = normalizeRoomToken(profile?.username || googleAccount?.id || 'user');
    const peer = normalizeRoomToken(chatContact?.username || chatId || 'contact');
    const pair = [me, peer].sort().join('--');
    return `mc-call-${pair}`;
  }, [chatContact?.username, chatId, googleAccount?.id, profile?.username]);

  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(contactName));
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const openCall = (videoCall: boolean) => {
    router.push({
      pathname: '/call',
      params: {
        roomId: roomIdForCall,
        username: chatContact?.username || chatId,
        name: contactName,
        video: videoCall ? '1' : '0',
      },
    });
  };

  const sendTextMessage = () => {
    const text = messageText.trim();
    if (!text) {
      return;
    }
    setMessages((prev) => [buildMessage('msg', text, 'text'), ...prev]);
    setMessageText('');
  };

  const appendAttachmentMessage = (label: string) => {
    setMessages((prev) => [buildMessage('file', label, 'file'), ...prev]);
  };

  const pickFromFiles = async () => {
    setIsAttachmentBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      appendAttachmentMessage(`Файл: ${result.assets[0].name}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось выбрать файл.');
    } finally {
      setIsAttachmentBusy(false);
    }
  };

  const pickFromGallery = async () => {
    setIsAttachmentBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Доступ закрыт', 'Разрешите доступ к галерее, чтобы прикреплять медиа.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const filename = result.assets[0].fileName || 'медиафайл';
      appendAttachmentMessage(`Медиа: ${filename}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть галерею.');
    } finally {
      setIsAttachmentBusy(false);
    }
  };

  const openFileChooser = () => {
    setIsSheetVisible(false);
    setTimeout(() => {
      Alert.alert('Источник вложения', 'Выберите, откуда прикрепить файл.', [
        { text: 'Файл', onPress: () => void pickFromFiles() },
        { text: 'Галерея', onPress: () => void pickFromGallery() },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }, 120);
  };

  const renderMessage = ({ item }: ListRenderItemInfo<ChatMessage>) => {
    const mine = item.sender === 'me';
    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
          {item.kind === 'file' ? (
            <View style={styles.attachmentRow}>
              <MaterialIcons name="attach-file" size={16} color={premiumPalette.textPrimary} />
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          ) : (
            <Text style={styles.messageText}>{item.text}</Text>
          )}
          <Text style={styles.messageTime}>{formatMessageTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={premiumPalette.textPrimary} />
          </Pressable>

          {chatContact?.avatarUri ? (
            <Image source={{ uri: chatContact.avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{contactAvatarLetter}</Text>
            </View>
          )}

          <View style={styles.headerContent}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>{contactName}</Text>
              {isProContact ? (
                <MaterialIcons name="verified" size={17} color={premiumPalette.accent} />
              ) : null}
            </View>
            <Text style={styles.headerStatus}>В сети</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={() => openCall(false)} style={styles.headerActionButton}>
              <MaterialIcons name="call" size={18} color={premiumPalette.textPrimary} />
            </Pressable>
            <Pressable onPress={() => openCall(true)} style={styles.headerActionButton}>
              <MaterialIcons name="videocam" size={19} color={premiumPalette.textPrimary} />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.composer}>
          <Pressable onPress={() => setIsSheetVisible(true)} style={styles.attachButton}>
            <MaterialIcons name="add-circle-outline" size={24} color={premiumPalette.accent} />
          </Pressable>

          <TextInput
            placeholder="Введите сообщение"
            placeholderTextColor="#73829B"
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1200}
          />

          <Pressable
            disabled={!messageText.trim()}
            onPress={sendTextMessage}
            style={({ pressed }) => [
              styles.sendButton,
              !messageText.trim() ? styles.sendButtonDisabled : null,
              pressed && messageText.trim() ? styles.sendButtonPressed : null,
            ]}>
            <MaterialIcons name="send" size={20} color={premiumPalette.textPrimary} />
          </Pressable>
        </View>

        <AttachmentBottomSheet
          visible={isSheetVisible}
          isBusy={isAttachmentBusy}
          onClose={() => setIsSheetVisible(false)}
          onSelectFileOrGallery={openFileChooser}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  header: {
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: premiumPalette.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: premiumPalette.surface,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.surfaceElevated,
    borderWidth: 1,
    borderColor: premiumPalette.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#173057',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarLetter: {
    color: premiumPalette.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  headerContent: {
    flex: 1,
    gap: 2,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    color: premiumPalette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  headerStatus: {
    color: '#71DFAF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.surfaceElevated,
    borderWidth: 1,
    borderColor: premiumPalette.border,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  messageRow: {
    width: '100%',
  },
  messageRowMine: {
    alignItems: 'flex-end',
  },
  messageRowTheirs: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  messageBubbleMine: {
    backgroundColor: '#185EBB',
    borderBottomRightRadius: 6,
  },
  messageBubbleTheirs: {
    backgroundColor: premiumPalette.surfaceElevated,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: premiumPalette.border,
  },
  messageText: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageTime: {
    color: '#BAC8DB',
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: premiumPalette.border,
    backgroundColor: premiumPalette.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.surfaceElevated,
    borderWidth: 1,
    borderColor: premiumPalette.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: '#0E1A2E',
    color: premiumPalette.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.accentStrong,
    borderWidth: 1,
    borderColor: '#318FFF',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
});
