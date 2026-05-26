import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Animated,
  Alert,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { RouteProp } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "../utils/config";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "VerifyOtp">;
  route: RouteProp<RootStackParamList, "VerifyOtp">;
};

const VerifyOtpDK = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [sdt, setSdt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem("emailForSignIn");
        const storedSdt = await AsyncStorage.getItem("sdt");
        if (storedEmail) setEmail(storedEmail);
        if (storedSdt) setSdt(storedSdt);
      } catch (error) {
        console.log("Loi khi lay du lieu");
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số");
      return;
    }

    try {
      setLoading(true);
      setError("");
      // Xác thực OTP qua SMS (thay vì email)
      const otpResponse = await axios.post(`${API_URL}/api/verify-otp-sms`, {
        sdt,
        otp,
      });

      const verified = otpResponse.data.verified;

      if (verified) {
        Alert.alert("Thành công", "Xác thực OTP thành công!", [
          {
            text: "OK",
            onPress: () => navigation.navigate("SignUpInfo", { email, sdt }),
          },
        ]);
      } else {
        setError("Mã OTP không chính xác");
      }
    } catch (error) {
      setError("Có lỗi xảy ra, vui lòng thử lại");
      console.log("Loi: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResendLoading(true);
      setError("");
      // Gửi lại OTP qua SMS
      await axios.post(`${API_URL}/api/send-otp-sms`, { sdt });
      setResendTimer(60);
      Alert.alert("Thành công", "Mã OTP mới đã được gửi đến số điện thoại của bạn!");
    } catch (error) {
      setError("Không thể gửi lại mã OTP, vui lòng thử lại");
      console.log("Loi gui lai OTP: ", error);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2572e9" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header gradient */}
          <LinearGradient
            colors={["#60aef8", "#3b90f4", "#2572e9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
          >
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <Animated.View
              style={[
                styles.brandingContainer,
                { transform: [{ scale: logoScale }] },
              ]}
            >
              <View style={styles.logoContainer}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={32}
                  color="#fff"
                />
              </View>
              <Text style={styles.appTitle}>Xác thực</Text>
              <Text style={styles.appTitleAccent}>OTP</Text>
              <Text style={styles.appSubtitle}>
                Nhập mã OTP đã được gửi đến số điện thoại của bạn
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* OTP Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Xác nhận mã OTP</Text>
              <Text style={styles.cardSubtitle}>
                Mã đã được gửi đến {sdt}
              </Text>
            </View>

            {/* OTP Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mã OTP</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="key-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="● ● ● ● ● ●"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color="#dc2626"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#60aef8", "#3b90f4", "#2572e9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnText}>Đang xác thực...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Xác nhận</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Chưa nhận được mã? </Text>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimer}>
                  Gửi lại sau {resendTimer}s
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendLoading}
                >
                  <Text style={styles.resendLink}>
                    {resendLoading ? "Đang gửi..." : "Gửi lại mã"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.divider} />
            </View>

            {/* Back to Signup */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Muốn thay đổi thông tin? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                <Text style={styles.signupLink}>Quay lại đăng ký</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Text style={styles.footer}>
            © 2025 OTT Education. All rights reserved.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f7ff",
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Header gradient ──
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    overflow: "hidden",
  },

  // ── Decorative circles ──
  circle1: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  circle2: {
    position: "absolute",
    top: "35%" as unknown as number,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  circle3: {
    position: "absolute",
    bottom: -20,
    left: "25%" as unknown as number,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  // ── Branding ──
  brandingContainer: {
    alignItems: "center",
  },
  logoContainer: {
    width: 56,
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
    lineHeight: 40,
  },
  appTitleAccent: {
    fontSize: 36,
    fontWeight: "800",
    color: "#67e8f9",
    marginBottom: 8,
    letterSpacing: 1,
    lineHeight: 40,
  },
  appSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  // ── Card ──
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 20,
    marginTop: -30,
    marginBottom: 20,
    shadowColor: "#3b90f4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 144, 244, 0.08)",
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },

  // ── Input Fields ──
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  },
  inputIconContainer: {
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 16 : 14,
    paddingHorizontal: 8,
    fontSize: 20,
    color: "#1f2937",
    letterSpacing: 4,
    textAlign: "center",
  },

  // ── Error ──
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Button ──
  btnPrimary: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#3b90f4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },

  // ── Resend OTP ──
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  resendText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  resendLink: {
    color: "#3b90f4",
    fontSize: 14,
    fontWeight: "600",
  },
  resendTimer: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },

  // ── Divider ──
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 14,
    letterSpacing: 1.5,
  },

  // ── Signup ──
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  signupLink: {
    color: "#3b90f4",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Footer ──
  footer: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
    marginBottom: 30,
  },
});

export default VerifyOtpDK;
