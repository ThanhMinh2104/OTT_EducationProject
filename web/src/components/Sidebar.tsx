import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaSignOutAlt,
  FaComments,
  FaCog,
  FaShieldAlt,
  FaMobileAlt,
  FaUserSlash,
  FaHistory,
} from 'react-icons/fa';
import UserProfileModal from './UserProfileModal';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface User {
  userID: string;
  name: string;
  email: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface Session {
  sessionId: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  deviceName: string;
  ipAddress: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface LoginHistoryItem {
  _id: string;
  userID: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  deviceName: string;
  deviceId: string;
  ipAddress: string;
  loginAt: string;
  logoutAt?: string;
  status: 'active' | 'logged_out' | 'expired';
}

interface Props {
  user: User | null;
  setUser: (u: User) => void;
}

const Sidebar = ({ user, setUser }: Props) => {
  const navigate = useNavigate();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'devices' | 'history' | 'deactivate'>(
    'account'
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openProfile = () => {
    setShowQuickMenu(false);
    setShowProfileModal(true);
  };

  const openSettings = (tab: 'account' | 'devices' | 'history' | 'deactivate' = 'account') => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
    if (tab === 'devices') {
      fetchSessions();
    } else if (tab === 'history') {
      fetchLoginHistory();
    }
  };

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const response = await axiosInstance.get('/sessions');
      setSessions(response.data.sessions);
    } catch (error) {
      toast.error('Không thể tải danh sách thiết bị');
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await axiosInstance.get('/login-history');
      setLoginHistory(response.data.history);
    } catch (error) {
      toast.error('Không thể tải lịch sử đăng nhập');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLogoutDevice = async (sessionId: string) => {
    if (!confirm('Bạn có chắc muốn đăng xuất thiết bị này?')) return;

    try {
      await axiosInstance.delete(`/sessions/${sessionId}`);
      toast.success('Đã đăng xuất thiết bị');
      fetchSessions();
    } catch (error) {
      toast.error('Không thể đăng xuất thiết bị');
    }
  };

  const handleLogoutAllOthers = async () => {
    if (!confirm('Bạn có chắc muốn đăng xuất tất cả thiết bị khác?')) return;

    try {
      await axiosInstance.delete('/sessions/others/all');
      toast.success('Đã đăng xuất tất cả thiết bị khác');
      fetchSessions();
    } catch (error) {
      toast.error('Không thể đăng xuất');
    }
  };

  const handleDeactivateAccount = async () => {
    const confirmed = confirm(
      'Bạn có chắc chắn muốn vô hiệu hóa tài khoản?\n\nTài khoản sẽ bị khóa. Bạn có thể mở lại bằng cách xác nhận OTP khi đăng nhập.'
    );
    if (!confirmed) return;

    try {
      await axiosInstance.post('/users/self-deactivate');
      toast.success('Tài khoản đã được vô hiệu hóa');
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } catch (error) {
      toast.error('Không thể vô hiệu hóa tài khoản');
    }
  };

  const handleLogout = async () => {
    if (user) {
      await fetch('http://localhost:5000/api/updateStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.userID, trangThai: 'offline' }),
      });
    }
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <>
      <div className="w-[68px] h-screen bg-gradient-to-b from-[#0e9de8] to-[#0077c2] flex flex-col items-center py-3.5 shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.12)]">
        <div className="flex flex-col items-center gap-6">
          <div
            className="w-11 h-11 rounded-full overflow-hidden cursor-pointer border-2 border-white/60 hover:border-white hover:scale-105 transition-all"
            onClick={() => setShowQuickMenu((v) => !v)}
          >
            <img
              src={user?.anhDaiDien || 'https://via.placeholder.com/48'}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer text-white/85 text-xl hover:bg-white/20 hover:text-white hover:scale-105 transition-all">
            <FaComments />
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer text-white/85 text-xl hover:bg-white/20 hover:text-white hover:scale-105 transition-all"
            onClick={() => openSettings('account')}
            title="Cài đặt"
          >
            <FaCog />
          </div>
        </div>
      </div>

      {/* Quick menu khi click avatar */}
      {showQuickMenu && (
        <div className="fixed top-3.5 left-[76px] bg-white rounded-[10px] shadow-[0_4px_20px_rgba(0,0,0,0.15)] min-w-[210px] z-999 overflow-hidden animate-fade-slide-in">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50">
            <img
              src={user?.anhDaiDien || 'https://via.placeholder.com/40'}
              alt="avatar"
              className="w-[38px] h-[38px] rounded-full object-cover border-2 border-[#0e9de8]"
            />
            <span className="font-semibold text-sm text-gray-800">{user?.name}</span>
          </div>
          <div
            className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-gray-700 hover:bg-blue-50 transition-colors"
            onClick={openProfile}
          >
            <FaUser className="text-[15px] text-gray-500" />
            <span>Hồ sơ của bạn</span>
          </div>
          <div
            className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-red-500 border-t border-gray-100 hover:bg-blue-50 transition-colors"
            onClick={() => {
              setShowQuickMenu(false);
              setShowLogoutModal(true);
            }}
          >
            <FaSignOutAlt className="text-[15px] text-red-500" />
            <span>Đăng xuất</span>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          onClose={() => setShowProfileModal(false)}
          user={user}
          setUser={(u) => {
            setUser(u);
            sessionStorage.setItem('user', JSON.stringify(u));
          }}
        />
      )}

      {/* Logout Confirm Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[340px] p-6 animate-fade-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <FaSignOutAlt className="text-red-500 text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Đăng xuất</h3>
              <p className="text-sm text-gray-500 text-center">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => setShowLogoutModal(false)}
              >
                Hủy
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden animate-fade-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Cài đặt</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <span className="text-gray-500 text-xl">×</span>
              </button>
            </div>

            <div className="flex h-[calc(85vh-88px)]">
              {/* Sidebar Menu */}
              <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-1">
                  <button
                    onClick={() => setSettingsTab('account')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      settingsTab === 'account'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FaShieldAlt className="text-lg" />
                    <span className="font-medium">Tài khoản & Bảo mật</span>
                  </button>
                  <button
                    onClick={() => {
                      setSettingsTab('devices');
                      fetchSessions();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      settingsTab === 'devices'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FaMobileAlt className="text-lg" />
                    <span className="font-medium">Quản lý thiết bị</span>
                  </button>
                  <button
                    onClick={() => {
                      setSettingsTab('history');
                      fetchLoginHistory();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      settingsTab === 'history'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FaHistory className="text-lg" />
                    <span className="font-medium">Lịch sử đăng nhập</span>
                  </button>
                  <button
                    onClick={() => setSettingsTab('deactivate')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      settingsTab === 'deactivate'
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FaUserSlash className="text-lg" />
                    <span className="font-medium">Vô hiệu hóa tài khoản</span>
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowLogoutModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt className="text-lg" />
                    <span className="font-medium">Đăng xuất</span>
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-white">
                {/* Tab: Tài khoản & Bảo mật */}
                {settingsTab === 'account' && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Tài khoản & Bảo mật</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-4 mb-3">
                          <img
                            src={user?.anhDaiDien || 'https://via.placeholder.com/64'}
                            alt="avatar"
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
                          />
                          <div>
                            <p className="font-semibold text-gray-800">{user?.name}</p>
                            <p className="text-sm text-gray-600">{user?.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowSettingsModal(false);
                            openProfile();
                          }}
                          className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                          Chỉnh sửa hồ sơ
                        </button>
                      </div>

                      <div className="p-4 border border-gray-200 rounded-xl">
                        <h4 className="font-semibold text-gray-800 mb-2">Thông tin tài khoản</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">User ID:</span>
                            <span className="font-medium text-gray-800">{user?.userID}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Số điện thoại:</span>
                            <span className="font-medium text-gray-800">{user?.sdt}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Giới tính:</span>
                            <span className="font-medium text-gray-800">
                              {user?.gioTinh || 'Chưa cập nhật'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Quản lý thiết bị */}
                {settingsTab === 'devices' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-800">Quản lý thiết bị</h3>
                      {sessions.length > 1 && (
                        <button
                          onClick={handleLogoutAllOthers}
                          className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Đăng xuất tất cả thiết bị khác
                        </button>
                      )}
                    </div>

                    {loadingSessions ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Đang tải...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sessions.map((session) => (
                          <div
                            key={session.sessionId}
                            className={`p-4 rounded-xl border-2 ${
                              session.isCurrent
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="text-3xl">
                                  {session.deviceType === 'mobile'
                                    ? '📱'
                                    : session.deviceType === 'desktop'
                                      ? '💻'
                                      : '🌐'}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-800">
                                    {session.deviceName}
                                    {session.isCurrent && (
                                      <span className="ml-2 text-xs font-normal text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                        Thiết bị này
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-600">IP: {session.ipAddress}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Hoạt động:{' '}
                                    {new Date(session.lastActive).toLocaleString('vi-VN')}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Đăng nhập: {new Date(session.createdAt).toLocaleString('vi-VN')}
                                  </p>
                                </div>
                              </div>
                              {!session.isCurrent && (
                                <button
                                  onClick={() => handleLogoutDevice(session.sessionId)}
                                  className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                                >
                                  Đăng xuất
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Lịch sử đăng nhập */}
                {settingsTab === 'history' && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Lịch sử đăng nhập</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Hiển thị 50 lần đăng nhập gần nhất của tài khoản
                    </p>

                    {loadingHistory ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Đang tải...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {loginHistory.map((item) => (
                          <div
                            key={item._id}
                            className="p-4 rounded-xl border border-gray-200 bg-white"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">
                                  {item.deviceType === 'mobile'
                                    ? '📱'
                                    : item.deviceType === 'desktop'
                                      ? '💻'
                                      : '🌐'}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-800">{item.deviceName}</p>
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full ${
                                        item.status === 'active'
                                          ? 'bg-green-100 text-green-700'
                                          : item.status === 'logged_out'
                                            ? 'bg-gray-100 text-gray-600'
                                            : 'bg-yellow-100 text-yellow-700'
                                      }`}
                                    >
                                      {item.status === 'active'
                                        ? 'Đang hoạt động'
                                        : item.status === 'logged_out'
                                          ? 'Đã đăng xuất'
                                          : 'Hết hạn'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">IP: {item.ipAddress}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Đăng nhập: {new Date(item.loginAt).toLocaleString('vi-VN')}
                                  </p>
                                  {item.logoutAt && (
                                    <p className="text-xs text-gray-500">
                                      Đăng xuất: {new Date(item.logoutAt).toLocaleString('vi-VN')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {loginHistory.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Chưa có lịch sử đăng nhập
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Vô hiệu hóa tài khoản */}
                {settingsTab === 'deactivate' && (
                  <div>
                    <h3 className="text-xl font-bold text-red-600 mb-4">Vô hiệu hóa tài khoản</h3>
                    <div className="p-6 bg-red-50 border border-red-200 rounded-xl mb-6">
                      <p className="text-red-800 font-semibold mb-2">⚠️ Lưu ý quan trọng</p>
                      <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                        <li>Tài khoản của bạn sẽ bị khóa tạm thời</li>
                        <li>Bạn có thể mở lại bằng cách xác nhận OTP khi đăng nhập</li>
                        <li>Tất cả phiên đăng nhập hiện tại sẽ bị đăng xuất</li>
                      </ul>
                    </div>
                    <button
                      onClick={handleDeactivateAccount}
                      className="w-full py-3 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
                    >
                      Vô hiệu hóa tài khoản của tôi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
