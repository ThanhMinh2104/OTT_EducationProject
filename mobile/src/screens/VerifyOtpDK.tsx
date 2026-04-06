import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { RouteProp } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../utils/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "VerifyOtp">;
  route: RouteProp<RootStackParamList, "VerifyOtp">;
};

const VerifyOtpDK = ({ navigation }: Props) => {
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [sdt, setSdt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<boolean>();

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

  const handleVerifyOtp = async () => {
    try {
      const otpResponse = await axios.post(`${API_URL}/api/verify-otp`, {
        email,
        otp,
      });

      console.log(email);

      const verified = otpResponse.data.verified;
      console.log(verified);

      if (verified)
        Alert.alert("Thành công", "Xác thực OTP thành công!", [
          {
            text: "OK",
            onPress: () => navigation.navigate("SignUpInfo", { email, sdt }),
          },
        ]);

      setError("Mã OTP không chính xác");
    } catch (error) {
      console.log("Loi: ", error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.appTitle}>OTT Education</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Xác nhận mã OTP</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập mã OTP của bạn"
            keyboardType="phone-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Đang gửi..." : "Tiếp tục"}
            </Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.gray}>Chưa nhận được mã? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.link}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f0f4f8" },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a73e8",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 16, color: "#333" },
  input: {
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 25,
    backgroundColor: "#fafafa",
  },
  error: {
    color: "#e53e3e",
    textAlign: "center",
    marginBottom: 8,
    fontSize: 13,
  },
  btnPrimary: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  btnDisabled: { backgroundColor: "#a0c4f1" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  link: { color: "#1a73e8", fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  gray: { color: "#666", fontSize: 14 },
});

export default VerifyOtpDK;
