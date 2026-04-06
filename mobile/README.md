# 📱 OTT Education Mobile App

React Native mobile application for OTT Education platform.

## 🚀 Tech Stack

- **React Native** 0.81.5
- **Expo** ~54.0
- **TypeScript** 5.9
- **React Navigation** 7.x
- **Axios** for API calls
- **Socket.IO Client** for real-time features
- **AsyncStorage** for local storage
- **Zustand** for state management

## 📦 Installation

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## 🎨 Screens

### ✅ Implemented:
- **LoginPassword** - Login screen with phone & password
- **SignUpScreen** - User registration
- **SignUpInfoScreen** - Additional user info
- **HomeScreen** - Main app screen (placeholder)
- **ForgotPasswordScreen** - Password recovery (placeholder)

### 🔄 Coming Soon:
- VerifyOtp
- ConfirmPassword
- Chat screens
- Profile management

## 🔧 Configuration

Update API URL in `src/utils/config.ts`:

```typescript
export const API_URL = 'http://YOUR_IP:5000';
```

**Note:** Use your local IP address, not `localhost` for mobile testing.

## 📱 Features

- ✅ Phone number validation (Vietnamese format)
- ✅ Password validation (min 8 chars, alphanumeric)
- ✅ JWT authentication
- ✅ Real-time status updates via Socket.IO
- ✅ AsyncStorage for token persistence
- ✅ Beautiful gradient UI
- ✅ Loading states & error handling
- ✅ Keyboard-aware scrolling

## 🎨 Design

- **Color Scheme:** Purple gradient (#667eea → #764ba2)
- **Typography:** System fonts with proper hierarchy
- **Components:** Native React Native components
- **Layout:** Mobile-first, responsive design
- **Animations:** Smooth transitions & feedback

## 📝 API Integration

### Login Flow:
1. User enters phone & password
2. Validate inputs client-side
3. POST `/api/login` → Get JWT token
4. POST `/api/updateStatus` → Set user online
5. Store token & user data in AsyncStorage
6. Navigate to Home screen

## 🔐 Authentication

- JWT tokens stored in AsyncStorage
- Token sent in Authorization header
- Auto-logout on token expiration
- Socket.IO connection with user status

## 🐛 Troubleshooting

### Cannot connect to backend:
- Check API_URL in config.ts
- Ensure backend is running
- Use local IP, not localhost
- Check firewall settings

### Expo errors:
```bash
# Clear cache
expo start -c

# Reset Metro bundler
npx react-native start --reset-cache
```

## 📄 License

MIT © 2025 OTT Education Team