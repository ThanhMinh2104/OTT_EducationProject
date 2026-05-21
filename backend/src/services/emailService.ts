import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export default async function sendOtpEmail(recipientEmail: string, otp: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Format OTP with spaces between digits for better readability
  const formattedOtp = otp.split('').join(' ');
  
  // Calculate expiry time (10 minutes from now)
  const expiryTime = new Date(Date.now() + 10 * 60 * 1000);
  const expiryTimeStr = expiryTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Read HTML template
  const templatePath = path.join(__dirname, '../templates/otpEmail.html');
  let htmlContent = fs.readFileSync(templatePath, 'utf-8');

  // Replace placeholders with actual values
  htmlContent = htmlContent
    .replace(/{{OTP}}/g, otp)
    .replace(/{{FORMATTED_OTP}}/g, formattedOtp)
    .replace(/{{EXPIRY_TIME}}/g, expiryTimeStr)
    .replace(/{{YEAR}}/g, new Date().getFullYear().toString());

  await transporter.sendMail({
    from: `"OTT_Education 🎓" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: '🔐 Mã xác thực OTP của Hệ thống OTT_Education',
    text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn sau 10 phút (lúc ${expiryTimeStr}). Không chia sẻ mã này với bất kỳ ai.`,
    html: htmlContent,
  });
}
