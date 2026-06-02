import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import axiosInstance from '../utils/axios';
import QRCode from 'react-native-qrcode-svg';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'QRScanner'>;

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.65;

type Tab = 'myqr' | 'scan';

const QRScannerScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const currentUser = route.params?.currentUser;

  const [tab, setTab] = useState<Tab>('myqr');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const qrValue = currentUser ? `ott-edu://add-friend/${currentUser.userID}` : '';

  useEffect(() => {
    if (tab === 'scan' && !permission?.granted) {
      requestPermission();
    }
  }, [tab]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);

    // Parse QR value
    const match = data.match(/ott-edu:\/\/add-friend\/(.+)/);
    if (!match) {
      Alert.alert('Lỗi', 'QR code không hợp lệ', [
        { text: 'Quét lại', onPress: () => setScanned(false) },
      ]);
      return;
    }

    const scannedUserID = match[1];
    if (scannedUserID === currentUser?.userID) {
      Alert.alert('Thông báo', 'Đây là mã QR của chính bạn!', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.get(`/users/qr-profile/${scannedUserID}`);
      const foundUser = res.data;

      // Navigate to Contacts screen with the found user
      navigation.navigate('Contacts', {
        user: currentUser,
        scannedUser: foundUser,
      });
    } catch {
      Alert.alert('Lỗi', 'Không tìm thấy người dùng', [
        { text: 'Quét lại', onPress: () => setScanned(false) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleShareQR = async () => {
    try {
      await Share.share({
        message: `Kết bạn với ${currentUser?.name} trên OTT Education!\nMã QR: ${qrValue}`,
        title: 'Chia sẻ mã QR kết bạn',
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mã QR kết bạn</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'myqr' && styles.tabActive]}
          onPress={() => setTab('myqr')}
        >
          <Ionicons
            name="qr-code-outline"
            size={16}
            color={tab === 'myqr' ? '#0068FF' : '#888'}
          />
          <Text style={[styles.tabText, tab === 'myqr' && styles.tabTextActive]}>
            Mã QR của tôi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'scan' && styles.tabActive]}
          onPress={() => setTab('scan')}
        >
          <Ionicons
            name="camera-outline"
            size={16}
            color={tab === 'scan' ? '#0068FF' : '#888'}
          />
          <Text style={[styles.tabText, tab === 'scan' && styles.tabTextActive]}>
            Quét mã QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab: My QR */}
      {tab === 'myqr' && (
        <View style={styles.myQRContainer}>
          {/* User info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{currentUser?.name}</Text>
            <Text style={styles.userSubtitle}>Quét mã để kết bạn với tôi</Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrWrapper}>
            {qrValue ? (
              <QRCode
                value={qrValue}
                size={220}
                color="#0068FF"
                backgroundColor="#fff"
                logo={{ uri: currentUser?.anhDaiDien }}
                logoSize={40}
                logoBackgroundColor="#fff"
                logoBorderRadius={20}
              />
            ) : (
              <ActivityIndicator color="#0068FF" />
            )}
          </View>

          {/* Share button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareQR}>
            <Ionicons name="share-outline" size={18} color="#0068FF" />
            <Text style={styles.shareBtnText}>Chia sẻ mã QR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab: Scan QR */}
      {tab === 'scan' && (
        <View style={styles.scanContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionContainer}>
              <Ionicons name="camera-off-outline" size={60} color="#ccc" />
              <Text style={styles.permissionText}>
                Cần quyền truy cập camera để quét mã QR
              </Text>
              <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                <Text style={styles.permissionBtnText}>Cấp quyền camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.scanHint}>
                Hướng camera vào mã QR của người bạn muốn kết bạn
              </Text>

              {/* Camera */}
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />

                {/* Overlay with scan box */}
                <View style={styles.overlay}>
                  <View style={styles.overlayTop} />
                  <View style={styles.overlayMiddle}>
                    <View style={styles.overlaySide} />
                    <View style={styles.scanBox}>
                      {/* Corner decorations */}
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <View style={styles.overlaySide} />
                  </View>
                  <View style={styles.overlayBottom} />
                </View>

                {/* Loading overlay */}
                {loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Đang tìm kiếm...</Text>
                  </View>
                )}
              </View>

              {/* Rescan button */}
              {scanned && !loading && (
                <TouchableOpacity
                  style={styles.rescanBtn}
                  onPress={() => setScanned(false)}
                >
                  <Text style={styles.rescanBtnText}>Quét lại</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0068FF',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#0068FF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#0068FF' },

  // My QR tab
  myQRContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  userInfo: { alignItems: 'center', gap: 4 },
  userName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  userSubtitle: { fontSize: 13, color: '#888' },
  qrWrapper: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
  },
  shareBtnText: { color: '#0068FF', fontSize: 14, fontWeight: '600' },

  // Scan tab
  scanContainer: { flex: 1, alignItems: 'center' },
  scanHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cameraWrapper: {
    width: width,
    height: width,
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 14 },

  rescanBtn: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#0068FF',
    borderRadius: 10,
  },
  rescanBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  permissionText: { fontSize: 14, color: '#666', textAlign: 'center' },
  permissionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0068FF',
    borderRadius: 10,
  },
  permissionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default QRScannerScreen;
