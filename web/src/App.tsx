import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUpScreen from './pages/SignUpScreen';
import SignUpInfoScreen from './pages/SignUpInfoScreen';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/signup-info" element={<SignUpInfoScreen />} />
      </Routes>
    </Router>
  );
};

export default App;
