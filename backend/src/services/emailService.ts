import nodemailer from 'nodemailer';

export default async function sendOtpEmail(recipientEmail: string, otp: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: 'Mã xác thực OTP của Hệ thống OTT_Education',
    text: `Mã OTP của bạn là: ${otp}`,
  });
}
