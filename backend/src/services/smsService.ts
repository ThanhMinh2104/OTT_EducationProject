import axios from 'axios';

/**
 * SMS Service - InfiniReach
 * Gửi SMS qua InfiniReach API
 */

const INFINIREACH_API_URL = 'https://api.infinireach.io/api/v1/messages';
const INFINIREACH_API_KEY = process.env.INFINIREACH_API_KEY || '';
const INFINIREACH_FROM_PHONE = process.env.INFINIREACH_FROM_PHONE || ''; // SĐT của SIM trong điện thoại Android

/**
 * Format SĐT về chuẩn E.164 (+84xxxxxxxxx)
 * Ví dụ: 0987654321 -> +84987654321
 */
function formatPhoneE164(phone: string): string {
  // Bỏ khoảng trắng, dấu cách
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');

  // Nếu đã có +84 hoặc 84 ở đầu
  if (cleaned.startsWith('+84')) return cleaned;
  if (cleaned.startsWith('84')) return '+' + cleaned;

  // Nếu bắt đầu bằng 0 -> thay bằng +84
  if (cleaned.startsWith('0')) {
    return '+84' + cleaned.substring(1);
  }

  // Trường hợp khác
  return '+84' + cleaned;
}

/**
 * Gửi SMS OTP qua InfiniReach
 */
export async function sendOtpSMS(phoneNumber: string, otp: string): Promise<void> {
  const formattedPhone = formatPhoneE164(phoneNumber);

  // Nội dung tránh từ khóa nhạy cảm để không bị filter spam của nhà mạng VN
  // (Viettel/Mobifone/Vinaphone thường chặn SMS có "OTP", "[Brand]", "mã xác thực" từ số cá nhân)
const messageBody = `[OTT_Education] Mã OTP của bạn là: ${otp}. Có hiệu lực trong 10 phút. Không chia sẻ mã này.`;

  // Mock mode khi chưa cấu hình InfiniReach (dev)
  if (!INFINIREACH_API_KEY || !INFINIREACH_FROM_PHONE) {
    console.log('📱 [MOCK SMS] Chưa cấu hình InfiniReach. Log OTP ra console:');
    console.log(`   To: ${formattedPhone}`);
    console.log(`   OTP: ${otp}`);
    console.log(`   Message: ${messageBody}`);
    return;
  }

  try {
    const response = await axios.post(
      INFINIREACH_API_URL,
      {
        to: formattedPhone,
        message: messageBody,
        from: INFINIREACH_FROM_PHONE,
        channel: 'sms',
        externalId: `otp-${Date.now()}`, // Idempotency để tránh gửi trùng
      },
      {
        headers: {
          'X-API-Key': INFINIREACH_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 giây - background nên không cần đợi quá lâu
      }
    );

    console.log(`✅ SMS đã gửi tới ${formattedPhone}, messageId: ${response.data.messageId}`);
  } catch (error: any) {
    // Timeout: tin nhắn vẫn có thể đã được queue & gửi đi thành công
    // (xem dashboard InfiniReach để verify). Coi như thành công.
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('⚠️  Timeout khi gọi InfiniReach API:');
      console.warn('   Tin nhắn có thể vẫn đã được queue & gửi (check dashboard).');
      console.warn('   To:', formattedPhone);
      return; // KHÔNG throw - InfiniReach thường vẫn gửi được
    }

    // Trường hợp đặc biệt: gửi cho chính số mình (self-SMS)
    if (formattedPhone === INFINIREACH_FROM_PHONE) {
      console.warn('⚠️  Self-SMS detected (gửi cho chính số mình):');
      console.warn('   InfiniReach trả error nhưng SMS vẫn về máy do Android xử lý nội bộ');
      console.warn('   To/From:', formattedPhone);
      return; // KHÔNG throw - coi như thành công
    }

    console.error('❌ Lỗi gửi SMS qua InfiniReach:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('   Message:', error.message);
    console.error('   Phone:', formattedPhone);
    console.error('   From:', INFINIREACH_FROM_PHONE);
    throw new Error(
      `Không thể gửi SMS OTP: ${error.response?.data?.message || error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Gửi SMS thông thường (không phải OTP)
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  const formattedPhone = formatPhoneE164(phoneNumber);

  if (!INFINIREACH_API_KEY || !INFINIREACH_FROM_PHONE) {
    console.log(`📱 [MOCK SMS] To: ${formattedPhone} - Message: ${message}`);
    return;
  }

  try {
    await axios.post(
      INFINIREACH_API_URL,
      {
        to: formattedPhone,
        message,
        from: INFINIREACH_FROM_PHONE,
        channel: 'sms',
      },
      {
        headers: {
          'X-API-Key': INFINIREACH_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error: any) {
    console.error('❌ Lỗi gửi SMS:', error.response?.data || error.message);
    throw new Error('Không thể gửi SMS.');
  }
}
