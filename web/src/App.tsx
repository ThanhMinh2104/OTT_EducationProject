import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPassword from './pages/LoginPassword';
import SignUpScreen from './pages/SignUpScreen';
import SignUpInfoScreen from './pages/SignUpInfoScreen';
import VerifyOTPDK from './pages/VerifyOtpDK';
import ForgotPassword from './pages/ForgotPassword';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPassword />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/signup-info" element={<SignUpInfoScreen />} />
        {/* Add more routes here */}
        <Route path="/home" element={<div>Home Page (Coming Soon)</div>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTPDK />} />
      </Routes>
    </Router>
  );
}

export default App;
