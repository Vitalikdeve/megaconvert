import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { type FriendRequest, useContacts } from '@/providers/contacts-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';
import MeshSDK from '@/src/services/mesh-sdk';
import { toast } from '@/src/utils/toast';

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

function normalizeMeshId(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function ContactAvatar({
  avatarUri,
  label,
  isMeshLinked,
}: {
  avatarUri: string | null;
  label: string;
  isMeshLinked: boolean;
}) {
  const avatarNode = avatarUri ? (
    <Image source={{ uri: avatarUri }} style={styles.avatar} />
  ) : (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackText}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );

  return (
    <View style={styles.avatarWrap}>
      {avatarNode}
      {isMeshLinked ? (
        <View style={styles.meshBadge}>
          <AntDesign name="wifi" size={12} color="#22C55E" />
        </View>
      ) : null}
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
  const [isMeshRadarEnabled, setMeshRadarEnabled] = useState(false);
  const [meshLinkedIds, setMeshLinkedIds] = useState<Set<string>>(new Set());

  const meshApiKey = process.env.EXPO_PUBLIC_MESH_API_KEY || 'ALPHA_MESH_API_KEY';
  const meshUserId = profile?.username || googleAccount?.id || '';
  const knownContactMeshIds = useMemo(() => {
    const ids = new Set<string>();
    contacts.forEach((contact) => {
      ids.add(normalizeMeshId(contact.username));
      ids.add(normalizeMeshId(contact.id));
    });
    return ids;
  }, [contacts]);

  useEffect(() => {
    if (!isMeshRadarEnabled) {
      setMeshLinkedIds(new Set());
      return;
    }

    const unsubscribe = MeshSDK.onDeviceFound((deviceUserId) => {
      const normalized = normalizeMeshId(deviceUserId);
      if (!knownContactMeshIds.has(normalized)) {
        return;
      }

      setMeshLinkedIds((previous) => {
        if (previous.has(normalized)) {
          return previous;
        }
        const next = new Set(previous);
        next.add(normalized);
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [isMeshRadarEnabled, knownContactMeshIds]);

  useEffect(() => {
    return () => {
      void MeshSDK.stopScanning();
      void MeshSDK.stopAdvertising();
    };
  }, []);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const handleMeshToggle = async (nextValue: boolean) => {
    setMeshRadarEnabled(nextValue);
    if (!nextValue) {
      await MeshSDK.stopScanning();
      await MeshSDK.stopAdvertising();
      setMeshLinkedIds(new Set());
      return;
    }

    const initialized = await MeshSDK.init(meshApiKey, meshUserId);
    if (!initialized) {
      setMeshRadarEnabled(false);
      Alert.alert('Offline Радар (Mesh)', 'Mesh-модуль недоступен в этой сборке приложения.');
      return;
    }

    const scanningStarted = await MeshSDK.startScanning();
    const advertisingStarted = await MeshSDK.startAdvertising();

    if (!scanningStarted || !advertisingStarted) {
      setMeshRadarEnabled(false);
      Alert.alert('Offline Радар (Mesh)', 'Не удалось запустить Mesh-режим на устройстве.');
      return;
    }

    toast.info('Поиск устройств поблизости...');
  };

  const meshStatusText = !isMeshRadarEnabled
    ? null
    : meshLinkedIds.size > 0
      ? 'Соединение установлено напрямую'
      : 'Поиск устройств поблизости...';

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
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={styles.ambientCyan} />
        <View style={styles.ambientIndigo} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#8DBDFF" />}
        showsVerticalScrollIndicator={false}>
        <GlassView intensity={20} radius={20} style={styles.topGlassSection}>
          <View style={styles.meshToggleRow}>
            <View style={styles.meshToggleTextWrap}>
              <Text style={styles.meshToggleTitle}>Offline Радар (Mesh)</Text>
              {meshStatusText ? <Text style={styles.meshToggleStatus}>{meshStatusText}</Text> : null}
            </View>
            <Switch
              value={isMeshRadarEnabled}
              onValueChange={(nextValue) => {
                void handleMeshToggle(nextValue);
              }}
              thumbColor={isMeshRadarEnabled ? '#00E5FF' : '#B8C2D3'}
              trackColor={{
                false: 'rgba(71, 85, 105, 0.58)',
                true: 'rgba(0, 229, 255, 0.35)',
              }}
            />
          </View>

          <NeonButton
            title="Добавить контакт по QR-коду"
            onPress={() => router.push('/add-contact')}
            icon={<MaterialIcons name="qr-code" size={18} color="#02161D" />}
            style={styles.addButton}
          />

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
        </GlassView>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {mainTab === 'contacts' ? (
          <View style={styles.listBlock}>
            {hasContacts ? (
              contacts.map((contact) => {
                const isMeshLinked = [contact.username, contact.id]
                  .map((value) => normalizeMeshId(value))
                  .some((value) => meshLinkedIds.has(value));

                return (
                  <Pressable
                    key={contact.id}
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[id]',
                        params: { id: contact.username },
                      })
                    }
                    style={({ pressed }) => [styles.cardPressable, pressed ? styles.cardPressed : null]}>
                    <GlassView intensity={20} radius={16} style={styles.card}>
                      <View style={styles.cardBody}>
                        <ContactAvatar avatarUri={contact.avatarUri} label={contact.fullName} isMeshLinked={isMeshLinked} />
                        <View style={styles.cardContent}>
                          <View style={styles.nameRow}>
                            <Text style={styles.cardTitle}>{contact.fullName}</Text>
                            {contact.isPro ? (
                              <MaterialIcons name="verified" size={18} color={premiumPalette.gold} />
                            ) : null}
                          </View>
                          <Text style={styles.cardSubtitle}>@{contact.username}</Text>
                          {isMeshLinked ? (
                            <Text style={styles.meshLinkedText}>Соединение установлено напрямую</Text>
                          ) : null}
                        </View>
                      </View>
                    </GlassView>
                  </Pressable>
                );
              })
            ) : (
              <GlassView intensity={20} radius={16} style={styles.emptyCard}>
                <View style={styles.emptyContent}>
                  <Text style={styles.emptyTitle}>Контактов пока нет</Text>
                  <Text style={styles.emptyHint}>
                    Нажмите «Добавить контакт по QR-коду», чтобы отправить первую заявку.
                  </Text>
                </View>
              </GlassView>
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
              <GlassView intensity={20} radius={16} style={styles.emptyCard}>
                <View style={styles.emptyContent}>
                  <Text style={styles.emptyTitle}>Заявок нет</Text>
                  <Text style={styles.emptyHint}>Новые заявки отобразятся здесь автоматически.</Text>
                </View>
              </GlassView>
            ) : (
              selectedRequests.map((request) => (
                <View key={request.id} style={styles.cardPressable}>
                  <GlassView intensity={20} radius={16} style={styles.card}>
                    <View style={styles.cardBody}>
                      <ContactAvatar avatarUri={request.avatarUri} label={request.fullName} isMeshLinked={false} />
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
                  </GlassView>
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
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientCyan: {
    position: 'absolute',
    top: -110,
    right: -30,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  ambientIndigo: {
    position: 'absolute',
    bottom: 60,
    left: -80,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(79, 70, 229, 0.13)',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    padding: 16,
    gap: 14,
  },
  topGlassSection: {
    padding: 10,
    gap: 10,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  addButton: {
    minHeight: 50,
  },
  meshToggleRow: {
    minHeight: 48,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  meshToggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  meshToggleTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  meshToggleStatus: {
    color: 'rgba(148, 250, 173, 0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(16, 16, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    borderColor: 'rgba(0, 229, 255, 0.48)',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
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
  cardPressable: {
    borderRadius: 16,
  },
  card: {
    padding: 12,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarWrap: {
    width: 44,
    height: 44,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: premiumPalette.textPrimary,
    fontWeight: '800',
  },
  meshBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: 'rgba(5, 15, 8, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
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
  meshLinkedText: {
    color: '#7EF5B0',
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(16, 16, 26, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    borderColor: 'rgba(0, 229, 255, 0.52)',
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
    padding: 16,
  },
  emptyContent: {
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
