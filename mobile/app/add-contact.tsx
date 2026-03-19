import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { useContacts } from '@/providers/contacts-context';

type AddContactTab = 'my_qr' | 'scan';

export default function AddContactScreen() {
  const router = useRouter();
  const { googleAccount, profile } = useAuth();
  const { sendRequestByQrData } = useContacts();

  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<AddContactTab>('my_qr');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);

  const qrValue = useMemo(() => {
    if (!googleAccount || !profile) {
      return '';
    }

    return JSON.stringify({
      type: 'megaconvert-contact',
      userId: googleAccount.id,
      username: profile.username,
    });
  }, [googleAccount, profile]);

  if (!googleAccount) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/setup-profile" />;
  }

  const onQrScanned = async (rawData: string) => {
    if (!rawData || scanCooldown || isProcessingScan) {
      return;
    }

    setIsProcessingScan(true);
    setScanCooldown(true);

    try {
      const result = await sendRequestByQrData(rawData);
      if (result.status === 'exists') {
        Alert.alert('Уже в контактах', `Пользователь @${result.username} уже есть в списке контактов.`);
      } else if (result.status === 'pending') {
        Alert.alert('Заявка уже отправлена', `Для @${result.username} уже есть активная заявка.`);
      } else {
        Alert.alert('Готово', `Заявка пользователю @${result.username} отправлена.`);
        router.back();
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'SELF_ADD') {
        Alert.alert('Ошибка', 'Нельзя добавить самого себя.');
      } else if (code === 'QR_INVALID' || code === 'QR_EMPTY') {
        Alert.alert('Ошибка QR', 'Этот QR-код не подходит для добавления контакта.');
      } else {
        Alert.alert('Ошибка', 'Не удалось отправить заявку в друзья.');
      }
    } finally {
      setIsProcessingScan(false);
      setTimeout(() => {
        setScanCooldown(false);
      }, 1500);
    }
  };

  const showScanner = activeTab === 'scan';
  const hasCameraPermission = permission?.granted;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.segmentedRow}>
          <Pressable
            onPress={() => setActiveTab('my_qr')}
            style={[styles.segmentButton, activeTab === 'my_qr' ? styles.segmentButtonActive : null]}>
            <Text
              style={[
                styles.segmentButtonText,
                activeTab === 'my_qr' ? styles.segmentButtonTextActive : null,
              ]}>
              Мой QR-код
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('scan')}
            style={[styles.segmentButton, activeTab === 'scan' ? styles.segmentButtonActive : null]}>
            <Text
              style={[
                styles.segmentButtonText,
                activeTab === 'scan' ? styles.segmentButtonTextActive : null,
              ]}>
              Сканировать
            </Text>
          </Pressable>
        </View>

        {activeTab === 'my_qr' ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Покажите этот QR-код коллеге</Text>
            <Text style={styles.qrSubtitle}>В QR зашиты ваш ID и username</Text>
            <View style={styles.qrContainer}>
              <QRCode value={qrValue} size={220} color="#0F172A" backgroundColor="#FFFFFF" />
            </View>
            <Text style={styles.usernameText}>@{profile.username}</Text>
          </View>
        ) : (
          <View style={styles.scannerBlock}>
            {!permission ? (
              <Text style={styles.infoText}>Проверяем разрешение на камеру...</Text>
            ) : hasCameraPermission ? (
              <>
                <View style={styles.cameraShell}>
                  {showScanner ? (
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={({ data }) => onQrScanned(data)}
                    />
                  ) : null}
                  <View style={styles.scanOverlay}>
                    <MaterialIcons name="qr-code-scanner" size={22} color={premiumPalette.textPrimary} />
                    <Text style={styles.scanOverlayText}>
                      Наведите камеру на QR-код пользователя
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoText}>
                  После сканирования заявка на добавление в друзья отправится автоматически.
                </Text>
              </>
            ) : (
              <View style={styles.permissionBlock}>
                <Text style={styles.infoText}>
                  Для сканирования нужен доступ к камере.
                </Text>
                <Pressable onPress={requestPermission} style={styles.permissionButton}>
                  <Text style={styles.permissionButtonText}>Разрешить камеру</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: premiumPalette.background,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#15325A',
    borderColor: '#245796',
  },
  segmentButtonText: {
    color: premiumPalette.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  segmentButtonTextActive: {
    color: premiumPalette.textPrimary,
  },
  qrCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: premiumPalette.surface,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  qrTitle: {
    color: premiumPalette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  qrSubtitle: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  qrContainer: {
    marginVertical: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  usernameText: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  scannerBlock: {
    gap: 12,
  },
  cameraShell: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: premiumPalette.border,
    backgroundColor: '#04080F',
  },
  scanOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 14, 24, 0.82)',
    borderWidth: 1,
    borderColor: '#23344F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scanOverlayText: {
    color: premiumPalette.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  infoText: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  permissionBlock: {
    gap: 12,
  },
  permissionButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: premiumPalette.accentStrong,
    borderWidth: 1,
    borderColor: '#318FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: premiumPalette.textPrimary,
    fontWeight: '700',
  },
});
