// Firebase Web API Key - lấy từ Firebase Console → Project Settings → General → Web API Key
// Dùng REST API vì Expo Go không hỗ trợ native Firebase Phone Auth
export const FIREBASE_WEB_API_KEY = 'AIzaSyDsJvOp3SuD9c3xf60U9vQsOMsdWMQpq8Q';

// Gửi OTP qua Firebase REST API
export const sendFirebaseOtp = async (phoneNumber: string, recaptchaToken: string = 'test') => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_WEB_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, recaptchaToken }),
  });
  const data = await response.json();
  if (!response.ok) throw { code: data.error?.message, message: data.error?.message };
  return data.sessionInfo as string; // sessionInfo dùng để verify OTP
};

// Verify OTP qua Firebase REST API → trả về idToken
export const verifyFirebaseOtp = async (sessionInfo: string, code: string) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_WEB_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionInfo, code }),
  });
  const data = await response.json();
  if (!response.ok) throw { code: data.error?.message, message: data.error?.message };
  return data.idToken as string;
};
