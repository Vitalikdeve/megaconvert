import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { io, type Socket } from 'socket.io-client';

import { AttachmentBottomSheet } from '@/components/attachment-bottom-sheet';
import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { useContacts } from '@/providers/contacts-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';
import {
  appendThreadMessage,
  buildOutgoingMessage,
  hydrateThreadMessages,
  normalizeThreadKey,
  subscribeThreadMessages,
  type ChatStoreMessage,
} from '@/src/services/chat-message-store';
import MeshSDK from '@/src/services/mesh-sdk';
import { toast } from '@/src/utils/toast';
import { encryptMessage, getOrCreateSharedSecret } from '@/utils/crypto';

type ChatMessage = ChatStoreMessage;

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

const liquidEase = Easing.bezier(0.23, 1, 0.32, 1);

type ChatSocketPayload = {
  contactId: string;
  senderId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
};

let chatSocket: Socket | null = null;
let chatSocketConnectingPromise: Promise<boolean> | null = null;
let chatSocketBaseUrl: string | null = null;

function resolveSocketBaseUrl(): string {
  const rawBaseUrl =
    process.env.EXPO_PUBLIC_SIGNALING_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://35.202.253.153.nip.io';

  return String(rawBaseUrl || '')
    .trim()
    .replace(/\/+$/g, '');
}

function getChatSocket(): Socket | null {
  const socketBaseUrl = resolveSocketBaseUrl();
  if (!socketBaseUrl) {
    return null;
  }

  if (chatSocket && chatSocketBaseUrl === socketBaseUrl) {
    return chatSocket;
  }

  chatSocket = io(socketBaseUrl, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 2,
    timeout: 2500,
  });
  chatSocketBaseUrl = socketBaseUrl;

  return chatSocket;
}

async function ensureChatSocketConnected(): Promise<boolean> {
  const socket = getChatSocket();
  if (!socket) {
    return false;
  }

  if (socket.connected) {
    return true;
  }

  if (!chatSocketConnectingPromise) {
    chatSocketConnectingPromise = new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanupListeners();
        resolve(false);
      }, 2600);

      const cleanupListeners = () => {
        clearTimeout(timeoutId);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };

      const onConnect = () => {
        cleanupListeners();
        resolve(true);
      };

      const onConnectError = () => {
        cleanupListeners();
        resolve(false);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onConnectError);
      socket.connect();
    }).finally(() => {
      chatSocketConnectingPromise = null;
    });
  }

  return chatSocketConnectingPromise;
}

async function sendEncryptedMessageViaInternet(payload: ChatSocketPayload): Promise<boolean> {
  const socket = getChatSocket();
  if (!socket) {
    return false;
  }

  const connected = await ensureChatSocketConnected();
  if (!connected) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, 2500);

    const safePayload: ChatSocketPayload = {
      contactId: payload.contactId,
      senderId: payload.senderId,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      createdAt: payload.createdAt,
    };

    socket.emit('chat:message', safePayload, (ack: { ok?: boolean } | undefined) => {
      clearTimeout(timeoutId);
      resolve(ack?.ok !== false);
    });
  });
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const { googleAccount, profile } = useAuth();
  const { contacts } = useContacts();
  const { width } = useWindowDimensions();

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

  const chatThreadId = useMemo(
    () => normalizeThreadKey(chatContact?.username || chatContact?.id || chatId),
    [chatContact?.id, chatContact?.username, chatId]
  );
  const senderId = useMemo(
    () => normalizeThreadKey(profile?.username || googleAccount?.id || 'me'),
    [googleAccount?.id, profile?.username]
  );
  const initialThreadMessages = useMemo(() => getInitialMessages(contactName), [contactName]);

  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    hydrateThreadMessages(chatThreadId, initialThreadMessages)
  );
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const screenEnter = useSharedValue(0);
  const contentMaxWidth = Math.min(860, Math.max(320, width - 18));
  const horizontalInset = Math.max(10, Math.floor((width - contentMaxWidth) / 2));

  useEffect(() => {
    hydrateThreadMessages(chatThreadId, initialThreadMessages);
    return subscribeThreadMessages(chatThreadId, setMessages);
  }, [chatThreadId, initialThreadMessages]);

  useEffect(() => {
    screenEnter.value = withTiming(1, {
      duration: 420,
      easing: liquidEase,
    });
  }, [screenEnter]);

  const enterAnimatedStyle = useAnimatedStyle(() => {
    const progress = screenEnter.value;
    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * 18 }, { scale: 0.986 + progress * 0.014 }],
    };
  });

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

  const sendTextMessage = async () => {
    const text = messageText.trim();
    if (!text) {
      return;
    }

    const contactId = normalizeThreadKey(chatContact?.username || chatContact?.id || chatId);
    if (!contactId) {
      toast.error('Ошибка E2EE шифрования при Mesh-передаче.');
      return;
    }

    try {
      const sharedSecret = await getOrCreateSharedSecret(contactId);
      const encrypted = await encryptMessage(text, sharedSecret);
      const contactNearby = MeshSDK.isPeerNearby(contactId);

      let sentViaInternet = false;
      if (!contactNearby) {
        sentViaInternet = await sendEncryptedMessageViaInternet({
          contactId,
          senderId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          createdAt: new Date().toISOString(),
        });
      }

      let transport: 'internet' | 'mesh' = 'internet';
      if (contactNearby || !sentViaInternet) {
        const meshSent = await MeshSDK.sendMessage(contactId, JSON.stringify(encrypted));
        if (!meshSent && !sentViaInternet) {
          toast.error('Ошибка E2EE шифрования при Mesh-передаче.');
          return;
        }

        if (meshSent) {
          transport = 'mesh';
          toast.success('Сообщение отправлено напрямую через Bluetooth (Offline).');
        }
      }

      appendThreadMessage(chatThreadId, buildOutgoingMessage(text, 'text', transport));
      setMessageText('');
    } catch {
      toast.error('Ошибка E2EE шифрования при Mesh-передаче.');
    }
  };

  const appendAttachmentMessage = (label: string) => {
    appendThreadMessage(chatThreadId, buildOutgoingMessage(label, 'file', 'local'));
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

      const assetName = result.assets[0].name || 'файл';
      if (/\.(mp4|mov|avi|mkv|webm)$/i.test(assetName)) {
        toast.error('Передача файла отменена: Mesh-сеть слишком слабая для видео.');
        return;
      }

      appendAttachmentMessage(`Файл: ${assetName}`);
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

      if (result.assets[0].type === 'video') {
        toast.error('Передача файла отменена: Mesh-сеть слишком слабая для видео.');
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
        {mine ? (
          <View style={[styles.messageBubble, styles.messageBubbleMine]}>
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
        ) : (
          <GlassView intensity={20} radius={17} style={[styles.messageBubble, styles.messageBubbleTheirs]}>
            {item.kind === 'file' ? (
              <View style={styles.attachmentRow}>
                <MaterialIcons name="attach-file" size={16} color={premiumPalette.textPrimary} />
                <Text style={styles.messageText}>{item.text}</Text>
              </View>
            ) : (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
            <Text style={styles.messageTime}>{formatMessageTime(item.createdAt)}</Text>
          </GlassView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={styles.ambientCyan} />
        <View style={styles.ambientIndigo} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.root}>
        <Animated.View style={[styles.enterLayer, enterAnimatedStyle]}>
          <GlassView intensity={20} radius={20} style={[styles.headerShell, { marginHorizontal: horizontalInset }]}>
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
                {isProContact ? <MaterialIcons name="verified" size={17} color={premiumPalette.gold} /> : null}
              </View>
              <Text style={styles.headerStatus}>В сети</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable onPress={() => openCall(false)} style={styles.headerActionButton}>
                <MaterialIcons name="call" size={18} color={premiumPalette.accent} />
              </Pressable>
              <Pressable onPress={() => openCall(true)} style={styles.headerActionButton}>
                <MaterialIcons name="videocam" size={19} color={premiumPalette.accent} />
              </Pressable>
            </View>
            </View>
          </GlassView>

          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalInset + 2 }]}
            keyboardShouldPersistTaps="handled"
          />

          <GlassView intensity={20} radius={24} style={[styles.composerFrame, { marginHorizontal: horizontalInset }]}>
            <View style={styles.composer}>
              <Pressable
                onPress={() => setIsSheetVisible(true)}
                style={({ pressed }) => [styles.attachButton, pressed ? styles.attachButtonPressed : null]}>
                <View style={styles.attachSpecular} />
                <MaterialIcons name="add" size={22} color="#02161D" />
              </Pressable>

              <TextInput
                placeholder="Введите сообщение"
                placeholderTextColor="#7F8EA8"
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1200}
              />

              <NeonButton
                size="icon"
                disabled={!messageText.trim()}
                onPress={() => {
                  void sendTextMessage();
                }}
                icon={<MaterialIcons name="send" size={20} color="#03171F" />}
                style={styles.sendNeonButton}
              />
            </View>
          </GlassView>

          <AttachmentBottomSheet
            visible={isSheetVisible}
            isBusy={isAttachmentBusy}
            onClose={() => setIsSheetVisible(false)}
            onSelectFileOrGallery={openFileChooser}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    right: -30,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
  },
  ambientIndigo: {
    position: 'absolute',
    bottom: 80,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
  },
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  enterLayer: {
    flex: 1,
  },
  headerShell: {
    minHeight: 74,
    marginHorizontal: 10,
    marginTop: 8,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(226, 232, 240, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.44)',
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
    color: '#8AF2FF',
    fontSize: 12,
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
    backgroundColor: 'rgba(0, 229, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.42)',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 9,
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
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 6,
    borderWidth: 1,
  },
  messageBubbleMine: {
    backgroundColor: '#4F46E5',
    borderColor: 'rgba(226, 232, 240, 0.26)',
    borderBottomRightRadius: 6,
    shadowColor: premiumPalette.indigo,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  messageBubbleTheirs: {
    borderBottomLeftRadius: 6,
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
    color: '#AAB9CC',
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  composerFrame: {
    marginHorizontal: 10,
    marginBottom: 10,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  composer: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumPalette.accent,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
    overflow: 'hidden',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.56,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  attachButtonPressed: {
    transform: [{ scale: 1.04 }, { rotate: '-3deg' }],
  },
  attachSpecular: {
    position: 'absolute',
    top: 2,
    left: 7,
    right: 7,
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(16, 16, 26, 0.64)',
    color: premiumPalette.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendNeonButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
});
