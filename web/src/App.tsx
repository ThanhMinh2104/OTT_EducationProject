// @ts-nocheck
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPassword from './pages/LoginPassword';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPassword />} />
        {/* Add more routes here */}
        <Route path="/home" element={<div>Home Page (Coming Soon)</div>} />
        <Route path="/signup" element={<div>Signup Page (Coming Soon)</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page (Coming Soon)</div>} />
      </Routes>
    </Router>
  );
}

export default App;
