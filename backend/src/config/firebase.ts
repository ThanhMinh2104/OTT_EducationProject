import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK
// Cần set biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON (JSON string của service account)
// hoặc GOOGLE_APPLICATION_CREDENTIALS (path đến file JSON)

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: dùng Application Default Credentials
    admin.initializeApp();
  }
}

export default admin;
