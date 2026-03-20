import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from 'react-native';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';

type ParamValue = string | string[] | undefined;

type UseMegaMeetCall = typeof import('../hooks/use-megameet-call').useMegaMeetCall;

type RTCViewProps = {
  objectFit?: 'cover' | 'contain';
  streamURL: string;
  style?: unknown;
  mirror?: boolean;
  zOrder?: number;
};

type WebRtcBridge = {
  RTCView: ComponentType<RTCViewProps>;
  useMegaMeetCall: UseMegaMeetCall;
};

type CallRouteParams = {
  roomId?: ParamValue;
  name?: ParamValue;
  username?: ParamValue;
  video?: ParamValue;
};

function resolveWebRtcBridge(): WebRtcBridge | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const webrtcModule = require('react-native-webrtc') as { RTCView?: ComponentType<RTCViewProps> };
    const hookModule = require('../hooks/use-megameet-call') as { useMegaMeetCall?: UseMegaMeetCall };

    if (!webrtcModule.RTCView || typeof hookModule.useMegaMeetCall !== 'function') {
      return null;
    }

    return {
      RTCView: webrtcModule.RTCView,
      useMegaMeetCall: hookModule.useMegaMeetCall,
    };
  } catch {
    return null;
  }
}

const webRtcBridge = resolveWebRtcBridge();

function normalizeVideoFlag(value: ParamValue): boolean {
  if (!value) {
    return true;
  }
  const source = Array.isArray(value) ? value[0] : value;
  return source !== '0' && source !== 'false' && source !== 'voice';
}

function normalizeStringParam(value: ParamValue, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const source = Array.isArray(value) ? value[0] : value;
  const trimmed = String(source || '').trim();
  return trimmed || fallback;
}

function normalizeRoomParam(value: ParamValue): string {
  const room = normalizeStringParam(value, '');
  return room;
}

function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('Информация', message);
}

type ControlButtonProps = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  onPress: () => void;
};

function ControlButton({ label, icon, active = false, danger = false, accent = false, onPress }: ControlButtonProps) {
  const iconColor = danger
    ? '#FFFFFF'
    : accent
      ? '#FFF7D9'
      : active
        ? premiumPalette.accent
        : premiumPalette.textSecondary;

  return (
    <View style={styles.controlItem}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.controlButtonCircle,
          active ? styles.controlButtonActive : null,
          danger ? styles.controlButtonDanger : null,
          accent ? styles.controlButtonAccent : null,
          pressed ? styles.controlButtonPressed : null,
        ]}>
        <View style={styles.controlSpecular} />
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </Pressable>
      <Text
        style={[
          styles.controlLabel,
          active || danger || accent ? styles.controlLabelAccent : null,
        ]}>
        {label}
      </Text>
    </View>
  );
}

function CallUnavailableScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.unavailableWrap}>
        <View style={styles.unavailableCard}>
          <MaterialIcons name="wifi-off" size={30} color={premiumPalette.textSecondary} />
          <Text style={styles.unavailableTitle}>Звонки временно недоступны</Text>
          <Text style={styles.unavailableBody}>
            В Expo Go и web-версии модуль WebRTC не поддерживается. Для теста звонков используйте Development Build
            или APK-сборку.
          </Text>
          <NeonButton title="Назад" onPress={() => router.back()} style={styles.unavailableNeonButton} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function CallScreen() {
  const params = useLocalSearchParams<CallRouteParams>();
  const { googleAccount, profile } = useAuth();

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  if (!webRtcBridge) {
    return <CallUnavailableScreen />;
  }

  return (
    <CallSessionScreen
      bridge={webRtcBridge}
      params={params}
      callerDisplayName={profile.fullName || googleAccount.fullName || 'Пользователь'}
      callerId={profile.username || googleAccount.id || 'me'}
    />
  );
}

function CallSessionScreen({
  bridge,
  params,
  callerDisplayName,
  callerId,
}: {
  bridge: WebRtcBridge;
  params: CallRouteParams;
  callerDisplayName: string;
  callerId: string;
}) {
  const router = useRouter();
  const [showWhiteboardModal, setShowWhiteboardModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const { width, height } = useWindowDimensions();

  const enableVideoByDefault = normalizeVideoFlag(params.video);
  const fallbackName = normalizeStringParam(params.username, 'Собеседник');
  const contactName = normalizeStringParam(params.name, fallbackName);
  const roomId = normalizeRoomParam(params.roomId);

  const safeRoomId = useMemo(() => {
    if (roomId) {
      return roomId;
    }
    const contact = normalizeStringParam(params.username, 'contact');
    return `mc-${[callerId, contact].sort().join('-')}`;
  }, [callerId, params.username, roomId]);

  const { RTCView, useMegaMeetCall } = bridge;
  const {
    localStream,
    remoteStream,
    remoteDisplayName,
    micEnabled,
    cameraEnabled,
    callState,
    errorMessage,
    toggleMic,
    toggleCamera,
    endCall,
  } = useMegaMeetCall({
    roomId: safeRoomId,
    displayName: callerDisplayName,
    enableVideoByDefault,
  });

  const remoteStreamUrl = remoteStream ? remoteStream.toURL() : null;
  const localStreamUrl = localStream ? localStream.toURL() : null;
  const hasLocalVideo = Boolean(localStream?.getVideoTracks().length);
  const canToggleCamera = hasLocalVideo;
  const isTabletLayout = Math.min(width, height) >= 700 || Math.max(width, height) >= 980;
  const pipWidth = isTabletLayout ? Math.min(220, Math.floor(width * 0.22)) : 118;
  const pipHeight = Math.round(pipWidth * 1.44);

  useEffect(() => {
    const permissionDenied = String(errorMessage || '')
      .toLowerCase()
      .includes('доступ к камере');
    setShowPermissionModal(permissionDenied);
  }, [errorMessage]);

  const closeCall = () => {
    endCall();
    router.back();
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.videoLayer}>
        <View pointerEvents="none" style={styles.ambilightLayer}>
          <View style={styles.ambilightCyan} />
          <View style={styles.ambilightIndigo} />
        </View>

        {remoteStreamUrl && enableVideoByDefault ? (
          <RTCView objectFit="cover" streamURL={remoteStreamUrl} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.remoteFallback}>
            <Text style={styles.remoteName}>{contactName}</Text>
            <Text style={styles.remoteStatus}>
              {errorMessage
                ? errorMessage
                : callState === 'joined'
                  ? 'Ожидание видео собеседника...'
                  : 'Подключаем звонок...'}
            </Text>
          </View>
        )}

        <View pointerEvents="none" style={styles.ambilightBlurWrap}>
          <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.callHeader}>
          <BlurView intensity={58} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.callHeaderGlow} />
          <View style={styles.callHeaderRow}>
            <View>
              <Text style={styles.callTitle}>{contactName}</Text>
              <Text style={styles.callSubTitle}>
                {remoteDisplayName && remoteDisplayName !== 'Собеседник' ? `В сети • ${remoteDisplayName}` : 'В сети'}
              </Text>
            </View>
            <MaterialIcons name="verified" size={20} color={premiumPalette.gold} />
          </View>
        </View>

        {localStreamUrl && hasLocalVideo ? (
          <View
            style={[
              styles.pipContainer,
              {
                width: pipWidth,
                height: pipHeight,
                right: isTabletLayout ? 20 : 14,
                top: isTabletLayout ? 102 : 94,
              },
            ]}>
            <RTCView
              objectFit="cover"
              mirror
              streamURL={localStreamUrl}
              style={StyleSheet.absoluteFill}
              zOrder={1}
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.controlsContainer, { bottom: isTabletLayout ? 28 : 20 }]}>
        <GlassView
          intensity={28}
          radius={30}
          style={[
            styles.controlsGlass,
            {
              maxWidth: isTabletLayout ? 980 : 760,
            },
          ]}>
          <View style={styles.controlsRow}>
            <ControlButton
              label={micEnabled ? 'Микрофон' : 'Без звука'}
              icon={micEnabled ? 'mic' : 'mic-off'}
              active={!micEnabled}
              onPress={toggleMic}
            />
            <ControlButton
              label={cameraEnabled ? 'Камера' : 'Камера выкл'}
              icon={cameraEnabled ? 'videocam' : 'videocam-off'}
              active={!cameraEnabled}
              onPress={() => {
                if (!canToggleCamera) {
                  showToast('В голосовом звонке камера не активна.');
                  return;
                }
                toggleCamera();
              }}
            />
            <ControlButton
              label="Экран"
              icon="cast"
              onPress={() => {
                showToast('Функция появится в следующем обновлении');
              }}
            />
            <ControlButton
              label="Доска Pro"
              icon="draw"
              accent
              onPress={() => {
                setShowWhiteboardModal(true);
              }}
            />
            <ControlButton label="Завершить" icon="call-end" danger onPress={closeCall} />
          </View>
        </GlassView>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showWhiteboardModal}
        onRequestClose={() => setShowWhiteboardModal(false)}>
        <View style={styles.modalOverlay}>
          <GlassView intensity={30} radius={20} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Электронная доска (Pro)</Text>
            <Text style={styles.modalBody}>Интерактивная доска доступна по подписке Pro. В разработке.</Text>
            <NeonButton
              title="Понятно"
              onPress={() => setShowWhiteboardModal(false)}
              style={styles.modalNeonButton}
            />
          </GlassView>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showPermissionModal}
        onRequestClose={() => setShowPermissionModal(false)}>
        <View style={styles.modalOverlay}>
          <GlassView intensity={30} radius={20} style={styles.permissionModalGlass}>
            <Text style={styles.permissionModalTitle}>Нужен доступ к камере</Text>
            <Text style={styles.permissionModalBody}>Для звонка необходим доступ к камере.</Text>
            <NeonButton
              title="Понятно"
              onPress={() => {
                setShowPermissionModal(false);
              }}
              style={styles.permissionModalButton}
            />
          </GlassView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  unavailableWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  unavailableCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.glass,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  unavailableTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  unavailableBody: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  unavailableNeonButton: {
    marginTop: 6,
    minHeight: 46,
    minWidth: 160,
  },
  videoLayer: {
    flex: 1,
    backgroundColor: '#050509',
  },
  ambilightLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  ambilightCyan: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
  },
  ambilightIndigo: {
    position: 'absolute',
    bottom: -100,
    left: -40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
  },
  remoteFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 5, 9, 0.74)',
    paddingHorizontal: 24,
    gap: 10,
    zIndex: 2,
  },
  ambilightBlurWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  remoteName: {
    color: premiumPalette.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  remoteStatus: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  callHeader: {
    position: 'absolute',
    top: 18,
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.glass,
    overflow: 'hidden',
    zIndex: 3,
  },
  callHeaderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  callHeaderRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  callSubTitle: {
    color: '#99EAF7',
    fontSize: 12,
    marginTop: 2,
  },
  pipContainer: {
    position: 'absolute',
    width: 118,
    height: 170,
    right: 14,
    top: 94,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.36)',
    backgroundColor: 'rgba(16, 16, 26, 0.8)',
    zIndex: 3,
  },
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  controlsGlass: {
    width: '100%',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  controlItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  controlButtonCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(16, 16, 26, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  controlSpecular: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
  },
  controlButtonActive: {
    borderColor: 'rgba(0, 229, 255, 0.48)',
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  controlButtonDanger: {
    borderColor: 'rgba(239, 68, 68, 0.66)',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  controlButtonAccent: {
    borderColor: 'rgba(251, 191, 36, 0.78)',
    backgroundColor: 'rgba(251, 191, 36, 0.46)',
    shadowColor: premiumPalette.gold,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  controlButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  controlLabel: {
    color: premiumPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  controlLabelAccent: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 9, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.54)',
    backgroundColor: premiumPalette.glassHeavy,
    padding: 18,
    gap: 12,
    shadowColor: premiumPalette.gold,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  modalTitle: {
    color: '#FFE7A8',
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  modalNeonButton: {
    marginTop: 2,
    minHeight: 46,
  },
  permissionModalGlass: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    gap: 12,
    borderColor: 'rgba(0, 229, 255, 0.38)',
    backgroundColor: 'rgba(14, 19, 31, 0.68)',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  permissionModalTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  permissionModalBody: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  permissionModalButton: {
    marginTop: 4,
    minHeight: 48,
  },
});
