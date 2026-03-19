import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { type FriendRequest, useContacts } from '@/providers/contacts-context';

type MainTab = 'contacts' | 'requests';
type RequestTab = 'incoming' | 'outgoing';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Только что';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function ContactAvatar({
  avatarUri,
  label,
}: {
  avatarUri: string | null;
  label: string;
}) {
  if (avatarUri) {
    return <Image source={{ uri: avatarUri }} style={styles.avatar} />;
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export default function ContactsScreen() {
  const router = useRouter();
  const { googleAccount, profile } = useAuth();
  const {
    contacts,
    incomingRequests,
    outgoingRequests,
    isLoading,
    errorMessage,
    refresh,
    acceptRequest,
    declineRequest,
    cancelOutgoingRequest,
  } = useContacts();

  const [mainTab, setMainTab] = useState<MainTab>('contacts');
  const [requestTab, setRequestTab] = useState<RequestTab>('incoming');
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const handleRequestAction = async (
    request: FriendRequest,
    action: 'accept' | 'decline' | 'cancel'
  ) => {
    setPendingRequestId(request.id);
    try {
      if (action === 'accept') {
        await acceptRequest(request.id);
      } else if (action === 'decline') {
        await declineRequest(request.id);
      } else {
        await cancelOutgoingRequest(request.id);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить заявку. Попробуйте ещё раз.');
    } finally {
      setPendingRequestId(null);
    }
  };

  const hasContacts = contacts.length > 0;
  const selectedRequests = requestTab === 'incoming' ? incomingRequests : outgoingRequests;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#8DBDFF" />}
        showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push('/add-contact')} style={styles.addButton}>
          <MaterialIcons name="qr-code" size={18} color={premiumPalette.textPrimary} />
          <Text style={styles.addButtonText}>Добавить контакт по QR-коду</Text>
        </Pressable>

        <View style={styles.segmentedRow}>
          <Pressable
            onPress={() => setMainTab('contacts')}
            style={[styles.segmentButton, mainTab === 'contacts' ? styles.segmentButtonActive : null]}>
            <Text
              style={[
                styles.segmentButtonText,
                mainTab === 'contacts' ? styles.segmentButtonTextActive : null,
              ]}>
              Контакты
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMainTab('requests')}
            style={[styles.segmentButton, mainTab === 'requests' ? styles.segmentButtonActive : null]}>
            <Text
              style={[
                styles.segmentButtonText,
                mainTab === 'requests' ? styles.segmentButtonTextActive : null,
              ]}>
              Заявки в друзья
            </Text>
          </Pressable>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {mainTab === 'contacts' ? (
          <View style={styles.listBlock}>
            {hasContacts ? (
              contacts.map((contact) => (
                <Pressable
                  key={contact.id}
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[id]',
                      params: { id: contact.username },
                    })
                  }
                  style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
                  <ContactAvatar avatarUri={contact.avatarUri} label={contact.fullName} />
                  <View style={styles.cardContent}>
                    <View style={styles.nameRow}>
                      <Text style={styles.cardTitle}>{contact.fullName}</Text>
                      {contact.isPro ? (
                        <MaterialIcons name="verified" size={18} color={premiumPalette.accent} />
                      ) : null}
                    </View>
                    <Text style={styles.cardSubtitle}>@{contact.username}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Контактов пока нет</Text>
                <Text style={styles.emptyHint}>
                  Нажмите «Добавить контакт по QR-коду», чтобы отправить первую заявку.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.listBlock}>
            <View style={styles.segmentedRow}>
              <Pressable
                onPress={() => setRequestTab('incoming')}
                style={[styles.segmentButton, requestTab === 'incoming' ? styles.segmentButtonActive : null]}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    requestTab === 'incoming' ? styles.segmentButtonTextActive : null,
                  ]}>
                  Входящие
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRequestTab('outgoing')}
                style={[styles.segmentButton, requestTab === 'outgoing' ? styles.segmentButtonActive : null]}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    requestTab === 'outgoing' ? styles.segmentButtonTextActive : null,
                  ]}>
                  Исходящие
                </Text>
              </Pressable>
            </View>

            {selectedRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Заявок нет</Text>
                <Text style={styles.emptyHint}>Новые заявки отобразятся здесь автоматически.</Text>
              </View>
            ) : (
              selectedRequests.map((request) => (
                <View key={request.id} style={styles.card}>
                  <ContactAvatar avatarUri={request.avatarUri} label={request.fullName} />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{request.fullName}</Text>
                    <Text style={styles.cardSubtitle}>@{request.username}</Text>
                    <Text style={styles.timestamp}>Создана: {formatDate(request.createdAt)}</Text>
                    {requestTab === 'incoming' ? (
                      <View style={styles.actionsRow}>
                        <Pressable
                          disabled={pendingRequestId === request.id}
                          onPress={() => handleRequestAction(request, 'accept')}
                          style={[
                            styles.actionButton,
                            styles.actionButtonPrimary,
                            pendingRequestId === request.id ? styles.actionButtonDisabled : null,
                          ]}>
                          <Text style={styles.actionPrimaryText}>Принять</Text>
                        </Pressable>
                        <Pressable
                          disabled={pendingRequestId === request.id}
                          onPress={() => handleRequestAction(request, 'decline')}
                          style={[
                            styles.actionButton,
                            pendingRequestId === request.id ? styles.actionButtonDisabled : null,
                          ]}>
                          <Text style={styles.actionDefaultText}>Отклонить</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.actionsRow}>
                        <Pressable
                          disabled={pendingRequestId === request.id}
                          onPress={() => handleRequestAction(request, 'cancel')}
                          style={[
                            styles.actionButton,
                            pendingRequestId === request.id ? styles.actionButtonDisabled : null,
                          ]}>
                          <Text style={styles.actionDefaultText}>Отменить</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
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
    padding: 16,
    gap: 14,
  },
  addButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: premiumPalette.accentStrong,
    borderWidth: 1,
    borderColor: '#318FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: premiumPalette.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#15325A',
    borderColor: '#245796',
  },
  segmentButtonText: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentButtonTextActive: {
    color: premiumPalette.textPrimary,
  },
  errorText: {
    color: '#FF8C8C',
    fontSize: 13,
  },
  listBlock: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surface,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#173057',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: premiumPalette.textPrimary,
    fontWeight: '800',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
  },
  timestamp: {
    color: premiumPalette.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#194884',
    borderColor: '#2B6CB0',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionPrimaryText: {
    color: premiumPalette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionDefaultText: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: premiumPalette.border,
    borderRadius: 14,
    backgroundColor: premiumPalette.surface,
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyHint: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
