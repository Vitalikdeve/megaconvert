import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { premiumPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';
import { useContacts } from '@/providers/contacts-context';
import { GlassView } from '@/src/components/ui/GlassView';
import { NeonButton } from '@/src/components/ui/NeonButton';

type AddContactTab = 'my_qr' | 'scan';

export default function AddContactScreen() {
  const router = useRouter();
  const { googleAccount, profile } = useAuth();
  const { sendRequestByQrData } = useContacts();
  const { width } = useWindowDimensions();

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

  const hasCameraPermission = permission?.granted;
  const qrSize = Math.max(180, Math.min(240, Math.floor(width * 0.56)));

  return (
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={styles.ambientCyan} />
        <View style={styles.ambientIndigo} />
      </View>

      <View style={styles.content}>
        <GlassView intensity={20} radius={20} style={styles.tabSwitcherGlass}>
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
        </GlassView>

        {activeTab === 'my_qr' ? (
          <GlassView intensity={24} radius={18} style={styles.qrCard}>
            <Text style={styles.qrTitle}>Покажите этот QR-код коллеге</Text>
            <Text style={styles.qrSubtitle}>В QR зашиты ваш ID и username</Text>

            <GlassView intensity={30} radius={20} style={styles.qrContainerGlass}>
              <View style={styles.qrContainerInner}>
                <QRCode value={qrValue} size={qrSize} color="#E2E8F0" backgroundColor="#050509" />
              </View>
            </GlassView>

            <Text style={styles.usernameText}>@{profile.username}</Text>
          </GlassView>
        ) : (
          <View style={styles.scannerBlock}>
            {!permission ? (
              <GlassView intensity={22} radius={16} style={styles.infoCard}>
                <Text style={styles.infoText}>Проверяем разрешение на камеру...</Text>
              </GlassView>
            ) : hasCameraPermission ? (
              <>
                <GlassView intensity={16} radius={18} style={styles.cameraGlass}>
                  <View style={styles.cameraShell}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={({ data }) => onQrScanned(data)}
                    />

                    <GlassView intensity={18} radius={12} style={styles.scanOverlayGlass}>
                      <View style={styles.scanOverlayRow}>
                        <MaterialIcons name="qr-code-scanner" size={22} color={premiumPalette.textPrimary} />
                        <Text style={styles.scanOverlayText}>Наведите камеру на QR-код пользователя</Text>
                      </View>
                    </GlassView>
                  </View>
                </GlassView>

                <GlassView intensity={22} radius={14} style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    После сканирования заявка на добавление в друзья отправится автоматически.
                  </Text>
                </GlassView>
              </>
            ) : (
              <GlassView intensity={24} radius={16} style={styles.permissionBlock}>
                <Text style={styles.infoText}>Для сканирования нужен доступ к камере.</Text>
                <NeonButton
                  title="Разрешить камеру"
                  onPress={requestPermission}
                  icon={<MaterialIcons name="photo-camera" size={18} color="#02161D" />}
                  style={styles.permissionNeonButton}
                />
              </GlassView>
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
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientCyan: {
    position: 'absolute',
    top: -110,
    right: -20,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
  },
  ambientIndigo: {
    position: 'absolute',
    bottom: 40,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 16,
    gap: 14,
  },
  tabSwitcherGlass: {
    padding: 8,
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
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(16, 16, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderColor: 'rgba(0, 229, 255, 0.5)',
    shadowColor: premiumPalette.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
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
  qrContainerGlass: {
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  qrContainerInner: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(5, 8, 15, 0.96)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  usernameText: {
    color: premiumPalette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  scannerBlock: {
    gap: 12,
  },
  cameraGlass: {
    padding: 10,
  },
  cameraShell: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.16)',
    backgroundColor: '#04080F',
  },
  scanOverlayGlass: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  scanOverlayRow: {
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
  infoCard: {
    padding: 12,
  },
  infoText: {
    color: premiumPalette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  permissionBlock: {
    padding: 12,
    gap: 12,
  },
  permissionNeonButton: {
    minHeight: 46,
  },
});
