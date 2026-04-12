import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPassword from './pages/LoginPassword';
import SignUpScreen from './pages/SignUpScreen';
import SignUpInfoScreen from './pages/SignUpInfoScreen';
import VerifyOTPDK from './pages/VerifyOtpDK';
import HomePage from './pages/HomePage';
import ForgotPassword from './pages/ForgotPassword';
import VerifyCode from './pages/VerifyCode';
import ConfirmPassword from './pages/ConfirmPassword';

function App() {
  return (
    <Router>
      {/* Toast thông báo - z-index cao nhất để không bị modal che */}
      <Toaster containerStyle={{ zIndex: 99999 }} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPassword />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/signup-info" element={<SignUpInfoScreen />} />
        {/* Add more routes here */}
        <Route path="/home" element={<HomePage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/confirm-password" element={<ConfirmPassword />} />
        <Route path="/verify-otp" element={<VerifyOTPDK />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
