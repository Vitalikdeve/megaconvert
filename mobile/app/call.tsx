import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { useMegaMeetCall } from '@/hooks/use-megameet-call';

function normalizeVideoFlag(value: string | string[] | undefined): boolean {
  if (!value) {
    return true;
  }
  const source = Array.isArray(value) ? value[0] : value;
  return source !== '0' && source !== 'false' && source !== 'voice';
}

function normalizeStringParam(value: string | string[] | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const source = Array.isArray(value) ? value[0] : value;
  const trimmed = String(source || '').trim();
  return trimmed || fallback;
}

function normalizeRoomParam(value: string | string[] | undefined): string {
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        active ? styles.controlButtonActive : null,
        danger ? styles.controlButtonDanger : null,
        accent ? styles.controlButtonAccent : null,
        pressed ? styles.controlButtonPressed : null,
      ]}>
      <MaterialIcons
        name={icon}
        size={22}
        color={
          danger ? '#FFFFFF' : active || accent ? '#FFFFFF' : premiumPalette.textSecondary
        }
      />
      <Text
        style={[
          styles.controlLabel,
          active || danger || accent ? styles.controlLabelActive : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    roomId?: string | string[];
    name?: string | string[];
    username?: string | string[];
    video?: string | string[];
  }>();
  const { googleAccount, profile } = useAuth();

  const enableVideoByDefault = normalizeVideoFlag(params.video);
  const fallbackName = normalizeStringParam(params.username, 'Собеседник');
  const contactName = normalizeStringParam(params.name, fallbackName);
  const roomId = normalizeRoomParam(params.roomId);
  const [showWhiteboardModal, setShowWhiteboardModal] = useState(false);

  const safeRoomId = useMemo(() => {
    if (roomId) {
      return roomId;
    }
    const me = profile?.username || googleAccount?.id || 'me';
    const contact = normalizeStringParam(params.username, 'contact');
    return `mc-${[me, contact].sort().join('-')}`;
  }, [googleAccount?.id, params.username, profile?.username, roomId]);

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
    displayName: profile?.fullName || googleAccount?.fullName || 'Пользователь',
    enableVideoByDefault,
  });

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const remoteStreamUrl = remoteStream ? remoteStream.toURL() : null;
  const localStreamUrl = localStream ? localStream.toURL() : null;
  const hasLocalVideo = Boolean(localStream?.getVideoTracks().length);
  const canToggleCamera = hasLocalVideo;

  const closeCall = () => {
    endCall();
    router.back();
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.videoLayer}>
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

        <View style={styles.callHeader}>
          <View>
            <Text style={styles.callTitle}>{contactName}</Text>
            <Text style={styles.callSubTitle}>
              {remoteDisplayName && remoteDisplayName !== 'Собеседник'
                ? `В сети • ${remoteDisplayName}`
                : 'В сети'}
            </Text>
          </View>
          <MaterialIcons name="verified" size={20} color={premiumPalette.accent} />
        </View>

        {localStreamUrl && hasLocalVideo ? (
          <View style={styles.pipContainer}>
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

      <View style={styles.controlsContainer}>
        <BlurView intensity={28} tint="dark" style={styles.controlsBlur}>
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
        </BlurView>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showWhiteboardModal}
        onRequestClose={() => setShowWhiteboardModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Электронная доска (Pro)</Text>
            <Text style={styles.modalBody}>
              Интерактивная доска доступна по подписке Pro. В разработке.
            </Text>
            <Pressable onPress={() => setShowWhiteboardModal(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Понятно</Text>
            </Pressable>
          </View>
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
  videoLayer: {
    flex: 1,
    backgroundColor: '#03060D',
  },
  remoteFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070E1A',
    paddingHorizontal: 24,
    gap: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#223450',
    backgroundColor: 'rgba(8, 13, 24, 0.76)',
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
    color: '#9DB0C9',
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
    borderColor: '#31527F',
    backgroundColor: '#111B2E',
  },
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  controlsBlur: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#233654',
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  controlButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3B58',
    backgroundColor: 'rgba(14, 22, 36, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    minHeight: 66,
  },
  controlButtonActive: {
    borderColor: '#3E5F90',
    backgroundColor: 'rgba(30, 58, 103, 0.85)',
  },
  controlButtonDanger: {
    borderColor: '#A34B53',
    backgroundColor: '#B13442',
  },
  controlButtonAccent: {
    borderColor: '#AF8F35',
    backgroundColor: '#7F6422',
  },
  controlButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  controlLabel: {
    color: premiumPalette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  controlLabelActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 6, 11, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3E434C',
    backgroundColor: '#141920',
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    color: '#F6E9BD',
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    color: premiumPalette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  modalButton: {
    marginTop: 2,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B38B29',
    backgroundColor: '#8A6C20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFF9E6',
    fontWeight: '800',
    fontSize: 14,
  },
});
