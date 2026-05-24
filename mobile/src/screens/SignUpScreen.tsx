import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StatusBar, Animated, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { API_URL } from "../utils/config";
import { FIREBASE_WEB_API_KEY, sendFirebaseOtp, verifyFirebaseOtp } from "../utils/firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = { navigation: StackNavigationProp<RootStackParamList, "SignUp"> };

const toE164 = (phone: string) => {
  if (phone.startsWith("0")) return "+84" + phone.slice(1);
  return phone;
};

const SignUpScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [sdt, setSDT] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionInfo, setSessionInfo] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    setEnabled(phoneRegex.test(sdt));
  }, [sdt]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setError("");

      // Kiểm tra SĐT đã tồn tại chưa
      const responseSDT = await axios.post(`${API_URL}/api/users/checksdt`, { sdt });
      if (responseSDT.data.exists) {
        setError("Số điện thoại đã được đăng ký!");
        return;
      }

      const phoneE164 = toE164(sdt);
      const session = await sendFirebaseOtp(phoneE164);
      setSessionInfo(session);
      setStep("otp");
      setResendTimer(60);
    } catch (err: any) {
      if (err.code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        setError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
      } else if (err.code === "INVALID_PHONE_NUMBER") {
        setError("Số điện thoại không hợp lệ.");
      } else {
        setError("Có lỗi xảy ra: " + (err.message || "Vui lòng thử lại"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const idToken = await verifyFirebaseOtp(sessionInfo, otp);

      // Verify với backend
      const res = await axios.post(`${API_URL}/api/verify-firebase-phone`, { idToken });
      if (res.data.verified) {
        await AsyncStorage.setItem("sdt", res.data.sdt);
        navigation.navigate("SignUpInfo", { sdt: res.data.sdt });
      }
    } catch (err: any) {
      if (err.code === "INVALID_CODE") {
        setError("Mã OTP không chính xác");
      } else if (err.code === "SESSION_EXPIRED") {
        setError("Mã OTP đã hết hạn, vui lòng gửi lại");
      } else {
        setError("Có lỗi xảy ra, vui lòng thử lại");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      setError("");
      const phoneE164 = toE164(sdt);
      const session = await sendFirebaseOtp(phoneE164);
      setSessionInfo(session);
      setResendTimer(60);
      Alert.alert("Thành công", "Mã OTP mới đã được gửi đến số điện thoại của bạn!");
    } catch (err: any) {
      setError("Không thể gửi lại OTP, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2572e9" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={["#60aef8", "#3b90f4", "#2572e9"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
          >
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />
            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Ionicons name="phone-portrait-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.appTitle}>OTT</Text>
              <Text style={styles.appTitleAccent}>Education</Text>
              <Text style={styles.appSubtitle}>
                {step === "phone" ? "Nhập số điện thoại để nhận mã OTP" : `Nhập mã OTP đã gửi đến ${sdt}`}
              </Text>
            </Animated.View>
          </LinearGradient>

          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Đăng ký</Text>
              <Text style={styles.cardSubtitle}>
                {step === "phone" ? "Xác thực số điện thoại của bạn" : "Nhập mã 6 chữ số"}
              </Text>
            </View>

            {step === "phone" ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Số điện thoại</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập số điện thoại (VD: 0912345678)"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    value={sdt}
                    onChangeText={setSDT}
                    editable={!loading}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mã OTP</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="key-outline" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="● ● ● ● ● ●"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, ""))}
                    maxLength={6}
                    editable={!loading}
                  />
                </View>
                <View style={styles.resendContainer}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendTimer}>Gửi lại sau {resendTimer}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                      <Text style={styles.resendLink}>{loading ? "Đang gửi..." : "Gửi lại mã"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={step === "phone" ? handleSendOtp : handleVerifyOtp}
              disabled={(step === "phone" ? !enabled : otp.length !== 6) || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#60aef8", "#3b90f4", "#2572e9"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, ((step === "phone" ? !enabled : otp.length !== 6) || loading) && styles.btnDisabled]}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnText}>Đang xử lý...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>{step === "phone" ? "Gửi mã OTP" : "Xác nhận"}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {step === "otp" && (
              <TouchableOpacity style={styles.backBtn} onPress={() => { setStep("phone"); setOtp(""); setError(""); }}>
                <Text style={styles.backBtnText}>← Thay đổi số điện thoại</Text>
              </TouchableOpacity>
            )}

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.loginLink}>Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Text style={styles.footer}>© 2025 OTT Education. All rights reserved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f7ff" },
  scrollContent: { flexGrow: 1 },
  headerGradient: { paddingTop: 20, paddingBottom: 60, paddingHorizontal: 24, alignItems: "center", overflow: "hidden" },
  circle1: { position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)" },
  circle2: { position: "absolute", top: "35%" as unknown as number, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.1)" },
  circle3: { position: "absolute", bottom: -20, left: "25%" as unknown as number, width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.1)" },
  brandingContainer: { alignItems: "center" },
  logoContainer: { width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  appTitle: { fontSize: 36, fontWeight: "800", color: "#ffffff", letterSpacing: 1, lineHeight: 40 },
  appTitleAccent: { fontSize: 36, fontWeight: "800", color: "#67e8f9", marginBottom: 8, letterSpacing: 1, lineHeight: 40 },
  appSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.9)", textAlign: "center", paddingHorizontal: 16, lineHeight: 20 },
  card: { backgroundColor: "#ffffff", borderRadius: 24, padding: 28, marginHorizontal: 20, marginTop: -30, marginBottom: 20, shadowColor: "#3b90f4", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10, borderWidth: 1, borderColor: "rgba(59,144,244,0.08)" },
  cardHeader: { alignItems: "center", marginBottom: 28 },
  cardTitle: { fontSize: 26, fontWeight: "700", color: "#1f2937", marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: "#9ca3af" },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 14, overflow: "hidden" },
  inputIconContainer: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: Platform.OS === "ios" ? 16 : 14, paddingHorizontal: 8, fontSize: 15, color: "#1f2937" },
  otpInput: { fontSize: 22, letterSpacing: 6, textAlign: "center" },
  resendContainer: { alignItems: "center", marginTop: 10 },
  resendLink: { color: "#3b90f4", fontSize: 14, fontWeight: "600" },
  resendTimer: { color: "#9ca3af", fontSize: 14 },
  errorContainer: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 14, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: "#dc2626", fontSize: 13, lineHeight: 18 },
  btnPrimary: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4, shadowColor: "#3b90f4", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.5 },
  loadingContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  backBtn: { alignItems: "center", marginTop: 14 },
  backBtnText: { color: "#9ca3af", fontSize: 14 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { color: "#9ca3af", fontSize: 10, fontWeight: "600", paddingHorizontal: 14, letterSpacing: 1.5 },
  loginContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { color: "#9ca3af", fontSize: 14 },
  loginLink: { color: "#3b90f4", fontSize: 14, fontWeight: "600" },
  footer: { textAlign: "center", color: "#9ca3af", fontSize: 11, marginTop: 4, marginBottom: 30 },
});

export default SignUpScreen;
