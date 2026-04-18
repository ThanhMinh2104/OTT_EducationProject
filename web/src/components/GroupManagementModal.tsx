import { useState, useEffect } from 'react';
import {
  FaTimes, FaUserShield, FaTrash, FaSearch, FaCrown, FaUserPlus,
  FaEdit, FaEllipsisV, FaInfoCircle, FaCopy, FaShare,
  FaUsers,
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

interface GroupMember {
  _id: string;
  userID: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  isActive: boolean;
}

interface BlockedMemberInfo {
  userID: string;
  name: string;
  avatar?: string;
}

interface GroupInfo {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
  members: GroupMember[];
  memberCount: number;
  blockedMembers?: string[];
  settings?: {
    requireApproval: boolean;
    highlightAdminMessages: boolean;
    allowNewMembersReadHistory: boolean;
    allowInviteLink: boolean;
    memberPermissions: {
      changeNameAvatar: boolean;
      pinMessages: boolean;
      createNotes: boolean;
      createPolls: boolean;
      sendMessages: boolean;
    };
  };
}

interface Props {
  groupInfo: GroupInfo;
  currentUserID: string;
  onClose: () => void;
  onUpdate: () => void;
  onDeleteGroup?: () => void;
}

interface GroupSettings {
  requireApproval: boolean;
  highlightAdminMessages: boolean;
  allowNewMembersReadHistory: boolean;
  allowInviteLink: boolean;
}

type Tab = 'members' | 'settings';

const GroupManagementModal = ({ groupInfo, currentUserID, onClose, onUpdate, onDeleteGroup }: Props) => {
  const [tab, setTab] = useState<Tab>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [showMemberMenu, setShowMemberMenu] = useState<string | null>(null);
  const [showConfirmPromote, setShowConfirmPromote] = useState(false);
  const [showConfirmDemote, setShowConfirmDemote] = useState(false);
  const [showConfirmKick, setShowConfirmKick] = useState(false);
  const [showConfirmTransferOwner, setShowConfirmTransferOwner] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupInfo.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState(groupInfo.description || '');

  // Block panel states
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [blockedMembersInfo, setBlockedMembersInfo] = useState<BlockedMemberInfo[]>([]);
  const [selectedToBlock, setSelectedToBlock] = useState<string[]>([]);
  const [blockSearchQuery, setBlockSearchQuery] = useState('');
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  // Group settings
  const [settings, setSettings] = useState<GroupSettings>({
    requireApproval: false,
    highlightAdminMessages: false,
    allowNewMembersReadHistory: false,
    allowInviteLink: true,
  });

  const [memberPermissions, setMemberPermissions] = useState({
    changeNameAvatar: true,
    pinMessages: true,
    createNotes: true,
    createPolls: true,
    sendMessages: true,
  });

  const currentMember = groupInfo.members.find(m => m.userID === currentUserID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  
  const groupInviteLink = `zalo.me/g/${groupInfo.groupID.substring(0, 10)}`;

  // Load settings từ groupInfo khi component mount HOẶC khi groupInfo thay đổi
  useEffect(() => {
    console.log('🔄 Loading settings from groupInfo:', {
      hasSettings: !!groupInfo.settings,
      settings: groupInfo.settings,
      memberPermissions: groupInfo.settings?.memberPermissions
    });
    
    if (groupInfo.settings) {
      const newSettings = {
        requireApproval: groupInfo.settings.requireApproval ?? false,
        highlightAdminMessages: groupInfo.settings.highlightAdminMessages ?? false,
        allowNewMembersReadHistory: groupInfo.settings.allowNewMembersReadHistory ?? false,
        allowInviteLink: groupInfo.settings.allowInviteLink ?? true,
      };
      
      console.log('📝 Setting state - settings:', newSettings);
      setSettings(newSettings);
      
      if (groupInfo.settings.memberPermissions) {
        const newPermissions = {
          changeNameAvatar: groupInfo.settings.memberPermissions.changeNameAvatar ?? true,
          pinMessages: groupInfo.settings.memberPermissions.pinMessages ?? true,
          createNotes: groupInfo.settings.memberPermissions.createNotes ?? true,
          createPolls: groupInfo.settings.memberPermissions.createPolls ?? true,
          sendMessages: groupInfo.settings.memberPermissions.sendMessages ?? true,
        };
        
        console.log('📝 Setting state - memberPermissions:', newPermissions);
        setMemberPermissions(newPermissions);
      }
    }
  }, [groupInfo.settings]); // Thêm dependency để re-run khi settings thay đổi

  const filteredMembers = groupInfo.members.filter(m =>
    m?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePromoteToAdmin = async (member: GroupMember) => {
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${member.userID}/role`, { role: 'admin' });
      toast.success(`Đã thêm ${member.name || 'thành viên'} làm phó nhóm`);
      setShowConfirmPromote(false);
      setSelectedMember(null);
      setShowMemberMenu(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi thêm phó nhóm');
    }
  };

  const handleDemoteFromAdmin = async (member: GroupMember) => {
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${member.userID}/role`, { role: 'member' });
      toast.success(`Đã gỡ quyền phó nhóm của ${member.name || 'thành viên'}`);
      setShowConfirmDemote(false);
      setSelectedMember(null);
      setShowMemberMenu(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi gỡ quyền');
    }
  };

  const handleKickMember = async (member: GroupMember) => {
    try {
      await axiosInstance.delete(`/groups/${groupInfo.groupID}/members/${member.userID}`);
      toast.success(`Đã xóa ${member.name || 'thành viên'} khỏi nhóm`);
      setShowConfirmKick(false);
      setSelectedMember(null);
      setShowMemberMenu(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi xóa thành viên');
    }
  };

  const handleTransferOwner = async (member: GroupMember) => {
    try {
      // Chuyển quyền owner cho member mới
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${member.userID}/role`, { role: 'owner' });
      // Tự động hạ quyền owner hiện tại xuống admin
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${currentUserID}/role`, { role: 'admin' });
      toast.success(`Đã chuyển quyền trưởng nhóm cho ${member.name || 'thành viên'}`);
      setShowConfirmTransferOwner(false);
      setSelectedMember(null);
      setShowMemberMenu(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi chuyển quyền');
    }
  };

  const handleUpdateGroupName = async () => {
    if (!newGroupName.trim()) {
      toast.error('Tên nhóm không được để trống');
      return;
    }
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}`, { name: newGroupName });
      toast.success('Đã cập nhật tên nhóm');
      setIsEditingName(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật tên nhóm');
    }
  };

  const handleUpdateDescription = async () => {
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}`, { description: newDescription });
      toast.success('Đã cập nhật mô tả nhóm');
      setIsEditingDescription(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật mô tả');
    }
  };

  const handleToggleSetting = async (key: keyof GroupSettings) => {
    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };
    setSettings(newSettings);
    
    try {
      console.log('📤 Sending settings update:', {
        settings: {
          ...newSettings,
          memberPermissions
        }
      });

      const response = await axiosInstance.put(`/groups/${groupInfo.groupID}/settings`, {
        settings: {
          ...newSettings,
          memberPermissions
        }
      });

      console.log('✅ Settings updated:', response.data);
      toast.success('Đã cập nhật cài đặt');
      onUpdate(); // Gọi onUpdate để fetch lại data
    } catch (error: any) {
      console.error('❌ Error updating settings:', error.response?.data || error);
      // Rollback nếu lỗi
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật cài đặt');
    }
  };

  const handleTogglePermission = async (key: keyof typeof memberPermissions) => {
    const oldValue = memberPermissions[key];
    const newValue = !oldValue;
    const newPermissions = { ...memberPermissions, [key]: newValue };
    
    console.log('🔄 Toggle permission:', {
      key,
      oldValue,
      newValue,
      newPermissions
    });
    
    setMemberPermissions(newPermissions);
    
    try {
      console.log('📤 Sending settings update:', {
        settings: {
          ...settings,
          memberPermissions: newPermissions
        }
      });

      const response = await axiosInstance.put(`/groups/${groupInfo.groupID}/settings`, {
        settings: {
          ...settings,
          memberPermissions: newPermissions
        }
      });

      console.log('✅ Settings updated:', response.data);
      toast.success('Đã cập nhật quyền');
      
      // Đợi 500ms rồi mới fetch để đảm bảo DB đã lưu
      setTimeout(() => {
        console.log('🔄 Fetching updated group data...');
        onUpdate();
      }, 500);
    } catch (error: any) {
      console.error('❌ Error updating settings:', error.response?.data || error);
      // Rollback nếu lỗi
      console.log('↩️ Rolling back to:', oldValue);
      setMemberPermissions(prev => ({ ...prev, [key]: oldValue }));
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật quyền');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(groupInviteLink);
    toast.success('Đã sao chép link');
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: groupInfo.name,
        text: `Tham gia nhóm ${groupInfo.name}`,
        url: groupInviteLink,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  // Fetch blocked members info khi mở block panel
  const fetchBlockedMembers = async () => {
    setIsLoadingBlocked(true);
    try {
      // Fetch trực tiếp từ group API để luôn có data mới nhất
      const groupRes = await axiosInstance.get(`/groups/${groupInfo.groupID}`);
      const blockedIDs: string[] = groupRes.data.blockedMembers || [];
      if (blockedIDs.length === 0) {
        setBlockedMembersInfo([]);
        return;
      }
      const results = await Promise.all(
        blockedIDs.map(async (uid) => {
          try {
            const res = await axiosInstance.post('/usersID', { userID: uid });
            return { userID: uid, name: res.data.name || uid, avatar: res.data.anhDaiDien };
          } catch {
            return { userID: uid, name: uid, avatar: undefined };
          }
        })
      );
      setBlockedMembersInfo(results);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  const handleOpenBlockPanel = () => {
    setShowBlockPanel(true);
    fetchBlockedMembers();
  };

  const handleBlockMembers = async () => {
    if (!selectedToBlock.length) return;
    try {
      await Promise.all(
        selectedToBlock.map((uid) =>
          axiosInstance.post(`/groups/${groupInfo.groupID}/block/${uid}`)
        )
      );
      toast.success(`Đã chặn ${selectedToBlock.length} thành viên`);
      setSelectedToBlock([]);
      setBlockSearchQuery('');
      setShowAddBlockModal(false); // quay lại danh sách chặn
      onUpdate();
      fetchBlockedMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi chặn thành viên');
    }
  };

  const handleUnblock = async (uid: string, name: string) => {
    try {
      await axiosInstance.post(`/groups/${groupInfo.groupID}/unblock/${uid}`);
      toast.success(`Đã bỏ chặn ${name}`);
      setBlockedMembersInfo((prev) => prev.filter((m) => m.userID !== uid));
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi bỏ chặn');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-[#2a2f35] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-700">
            {showAddBlockModal ? (
              <button
                onClick={() => { setShowAddBlockModal(false); setSelectedToBlock([]); setBlockSearchQuery(''); }}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-700 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            ) : showBlockPanel ? (
              <button
                onClick={() => setShowBlockPanel(false)}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-700 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-700 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            )}
            <h2 className="text-lg font-bold text-white flex-1">
              {showAddBlockModal ? 'Thêm vào danh sách chặn' : showBlockPanel ? 'Chặn khỏi nhóm' : 'Quản lý nhóm'}
            </h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Add Block View (inline, không phải modal) */}
            {showAddBlockModal && (
              <div className="flex flex-col h-full text-white">
                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      value={blockSearchQuery}
                      onChange={(e) => setBlockSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm thành viên"
                      className="w-full pl-9 pr-4 py-2 bg-gray-700 rounded-full text-sm text-white placeholder-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Member list */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  {groupInfo.members
                    .filter((m) => {
                      if (m.userID === currentUserID) return false;
                      if (m.role === 'owner') return false;
                      if (groupInfo.blockedMembers?.includes(m.userID)) return false;
                      if (blockSearchQuery && !m.name?.toLowerCase().includes(blockSearchQuery.toLowerCase())) return false;
                      return true;
                    })
                    .map((m) => (
                      <label
                        key={m.userID}
                        className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-700/50 rounded-xl px-2 -mx-2"
                      >
                        <input
                          type="checkbox"
                          checked={selectedToBlock.includes(m.userID)}
                          onChange={() =>
                            setSelectedToBlock((prev) =>
                              prev.includes(m.userID)
                                ? prev.filter((id) => id !== m.userID)
                                : [...prev, m.userID]
                            )
                          }
                          className="w-4 h-4 accent-blue-500 shrink-0"
                        />
                        <img
                          src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}`}
                          alt={m.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                        <span className="text-sm text-white font-medium">{m.name || m.userID}</span>
                      </label>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
                  <button
                    onClick={() => { setShowAddBlockModal(false); setSelectedToBlock([]); setBlockSearchQuery(''); }}
                    className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleBlockMembers}
                    disabled={!selectedToBlock.length}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Chặn thành viên
                  </button>
                </div>
              </div>
            )}

            {/* Block Panel */}
            {!showAddBlockModal && showBlockPanel && (
              <div className="text-white">
                {/* Mô tả */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Những người đã bị chặn không thể tham gia lại nhóm, trừ khi được trưởng, phó nhóm bỏ chặn hoặc thêm lại vào nhóm.
                  </p>
                </div>

                {/* Nút thêm vào danh sách chặn */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <button
                    onClick={() => { setShowAddBlockModal(true); setSelectedToBlock([]); setBlockSearchQuery(''); }}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-colors"
                  >
                    Thêm vào danh sách chặn
                  </button>
                </div>

                {/* Danh sách bị chặn */}
                <div className="px-4 py-3">
                  {isLoadingBlocked ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : blockedMembersInfo.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                        <FaUsers className="text-gray-500 text-2xl" />
                      </div>
                      <p className="text-sm text-gray-500">Chưa có thành viên nào bị chặn</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 font-semibold mb-3">
                        Thành viên bị chặn ({blockedMembersInfo.length})
                      </p>
                      <div className="space-y-2">
                        {blockedMembersInfo.map((m) => (
                          <div key={m.userID} className="flex items-center gap-3 py-2">
                            <img
                              src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}`}
                              alt={m.name}
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                            <span className="flex-1 text-sm text-white font-medium truncate">{m.name}</span>
                            <button
                              onClick={() => handleUnblock(m.userID, m.name)}
                              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white transition-colors shrink-0"
                            >
                              Bỏ chặn
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {!showBlockPanel && tab === 'settings' && (
              <div className="text-white">
                {/* Thông báo chỉ dành cho quản trị viên */}
                {!isOwner && !isAdmin && (
                  <div className="mx-4 mt-4 mb-3 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white mb-1">Tính năng chỉ dành cho quản trị viên</p>
                      <p className="text-xs text-gray-400">Chỉ trưởng nhóm và phó nhóm mới có thể thay đổi các cài đặt này</p>
                    </div>
                  </div>
                )}

                {/* Cho phép các thành viên trong nhóm */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Cho phép các thành viên trong nhóm:</h3>
                  
                  <div className="space-y-3">
                    <label className={`flex items-center justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <span className="text-sm text-white">Thay đổi tên & ảnh đại diện của nhóm</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.changeNameAvatar}
                        onChange={() => handleTogglePermission('changeNameAvatar')}
                        disabled={!isOwner && !isAdmin}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className={`flex items-start justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <span className="text-sm text-white flex-1 pr-3">Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.pinMessages}
                        onChange={() => handleTogglePermission('pinMessages')}
                        disabled={!isOwner && !isAdmin}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className={`flex items-center justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <span className="text-sm text-white">Tạo mới ghi chú, nhắc hẹn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.createNotes}
                        onChange={() => handleTogglePermission('createNotes')}
                        disabled={!isOwner && !isAdmin}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className={`flex items-center justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <span className="text-sm text-white">Tạo mới bình chọn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.createPolls}
                        onChange={() => handleTogglePermission('createPolls')}
                        disabled={!isOwner && !isAdmin}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className={`flex items-center justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <span className="text-sm text-white">Gửi tin nhắn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.sendMessages}
                        onChange={() => handleTogglePermission('sendMessages')}
                        disabled={!isOwner && !isAdmin}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>
                  </div>
                </div>

                {/* Chế độ phê duyệt thành viên mới */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className={`flex items-start justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Chế độ phê duyệt thành viên mới</span>
                        <FaInfoCircle className="text-gray-400 text-xs" />
                      </div>
                      <p className="text-xs text-gray-400">Yêu cầu phê duyệt từ trưởng/phó nhóm khi có người xin vào nhóm</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.requireApproval}
                      onChange={() => handleToggleSetting('requireApproval')}
                      disabled={!isOwner && !isAdmin}
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Đánh dấu tin nhắn từ trưởng/phó nhóm */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className={`flex items-start justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Đánh dấu tin nhắn từ trưởng/phó nhóm</span>
                        <FaInfoCircle className="text-gray-400 text-xs" />
                      </div>
                      <p className="text-xs text-gray-400">Tin nhắn từ trưởng/phó nhóm sẽ được đánh dấu đặc biệt</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.highlightAdminMessages}
                      onChange={() => handleToggleSetting('highlightAdminMessages')}
                      disabled={!isOwner && !isAdmin}
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Cho phép thành viên mới đọc tin nhắn gần nhất */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className={`flex items-start justify-between ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Cho phép thành viên mới đọc tin nhắn gần nhất</span>
                        <FaInfoCircle className="text-gray-400 text-xs" />
                      </div>
                      <p className="text-xs text-gray-400">Thành viên mới có thể xem lịch sử tin nhắn trước khi tham gia</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowNewMembersReadHistory}
                      onChange={() => handleToggleSetting('allowNewMembersReadHistory')}
                      disabled={!isOwner && !isAdmin}
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Cho phép dùng link tham gia nhóm */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className={`flex items-start justify-between mb-3 ${isOwner || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Cho phép dùng link tham gia nhóm</span>
                        <FaInfoCircle className="text-gray-400 text-xs" />
                      </div>
                      <p className="text-xs text-gray-400">Mọi người có link đều có thể tham gia nhóm</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowInviteLink}
                      onChange={() => handleToggleSetting('allowInviteLink')}
                      disabled={!isOwner && !isAdmin}
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>

                  {settings.allowInviteLink && (
                    <div className="flex items-center gap-2 bg-gray-700/50 rounded-lg px-3 py-2.5">
                      <span className="flex-1 text-sm text-blue-400 truncate font-mono">{groupInviteLink}</span>
                      <button
                        onClick={handleCopyLink}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-600 transition-colors text-white"
                        title="Sao chép"
                      >
                        <FaCopy className="text-sm" />
                      </button>
                      <button
                        onClick={handleShareLink}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-600 transition-colors text-white"
                        title="Chia sẻ"
                      >
                        <FaShare className="text-sm" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Chặn khỏi nhóm */}
                {(isOwner || isAdmin) && (
                  <button
                    onClick={handleOpenBlockPanel}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-700/50 transition-colors border-b border-gray-700"
                  >
                    <FaUsers className="text-white text-lg" />
                    <span className="text-sm text-white">Chặn khỏi nhóm</span>
                  </button>
                )}

                {/* Giải tán nhóm - chỉ hiện với owner */}
                {isOwner && onDeleteGroup && (
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-500/10 transition-colors"
                  >
                    <FaTrash className="text-red-400 text-lg" />
                    <span className="text-sm text-red-400 font-medium">Giải tán nhóm</span>
                  </button>
                )}
              </div>
            )}

            {!showBlockPanel && tab === 'members' && (
              <div className="p-4 space-y-4">
                {/* Search */}
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm thành viên..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>

                {/* Members list */}
                <div className="space-y-2">
                  {filteredMembers.map((member) => {
                    const canManage = isOwner || (isAdmin && member.role === 'member');
                    const isCurrentUser = member.userID === currentUserID;

                    return (
                      <div
                        key={member.userID}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-700/50 transition-colors group relative"
                      >
                        <img
                          src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userID}`}
                          alt={member.name || 'Member'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{member.name || member.userID}</p>
                          <div className="flex items-center gap-2">
                            {member.role === 'owner' && (
                              <span className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                                <FaCrown className="text-[10px]" /> Trưởng nhóm
                              </span>
                            )}
                            {member.role === 'admin' && (
                              <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                                <FaUserShield className="text-[10px]" /> Phó nhóm
                              </span>
                            )}
                            {member.role === 'member' && (
                              <span className="text-xs text-gray-400">Thành viên</span>
                            )}
                          </div>
                        </div>

                        {/* Actions menu */}
                        {canManage && !isCurrentUser && member.role !== 'owner' && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMemberMenu(showMemberMenu === member.userID ? null : member.userID);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-600 text-gray-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <FaEllipsisV className="text-xs" />
                            </button>

                            {showMemberMenu === member.userID && (
                              <div
                                className="absolute right-0 top-full mt-1 z-10 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 min-w-[200px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isOwner && (
                                  <>
                                    {member.role === 'member' && (
                                      <button
                                        onClick={() => {
                                          setSelectedMember(member);
                                          setShowConfirmPromote(true);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-gray-700 transition-colors"
                                      >
                                        <FaUserShield className="text-xs text-blue-400" />
                                        Thêm làm phó nhóm
                                      </button>
                                    )}
                                    {member.role === 'admin' && (
                                      <button
                                        onClick={() => {
                                          setSelectedMember(member);
                                          setShowConfirmDemote(true);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-gray-700 transition-colors"
                                      >
                                        <FaUserShield className="text-xs text-orange-400" />
                                        Gỡ quyền phó nhóm
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedMember(member);
                                        setShowConfirmTransferOwner(true);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-gray-700 transition-colors"
                                    >
                                      <FaCrown className="text-xs text-yellow-400" />
                                      Chuyển quyền trưởng nhóm
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setShowConfirmKick(true);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-gray-700"
                                >
                                  <FaTrash className="text-xs" />
                                  Xóa khỏi nhóm
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm modals */}
      {selectedMember && (
        <>
          <ConfirmModal
            show={showConfirmPromote}
            title="Thêm phó nhóm"
            message={`Bạn có chắc muốn thêm ${selectedMember.name || 'thành viên này'} làm phó nhóm?`}
            onConfirm={() => handlePromoteToAdmin(selectedMember)}
            onCancel={() => {
              setShowConfirmPromote(false);
              setSelectedMember(null);
            }}
            confirmText="Thêm"
          />

          <ConfirmModal
            show={showConfirmDemote}
            title="Gỡ quyền phó nhóm"
            message={`Bạn có chắc muốn gỡ quyền phó nhóm của ${selectedMember.name || 'thành viên này'}?`}
            onConfirm={() => handleDemoteFromAdmin(selectedMember)}
            onCancel={() => {
              setShowConfirmDemote(false);
              setSelectedMember(null);
            }}
            confirmText="Gỡ quyền"
          />

          <ConfirmModal
            show={showConfirmKick}
            title="Xóa thành viên"
            message={`Bạn có chắc muốn xóa ${selectedMember.name || 'thành viên này'} khỏi nhóm?`}
            onConfirm={() => handleKickMember(selectedMember)}
            onCancel={() => {
              setShowConfirmKick(false);
              setSelectedMember(null);
            }}
            isDanger
            confirmText="Xóa"
          />

          <ConfirmModal
            show={showConfirmTransferOwner}
            title="Chuyển quyền trưởng nhóm"
            message={`Bạn có chắc muốn chuyển quyền trưởng nhóm cho ${selectedMember.name || 'thành viên này'}? Bạn sẽ trở thành phó nhóm.`}
            onConfirm={() => handleTransferOwner(selectedMember)}
            onCancel={() => {
              setShowConfirmTransferOwner(false);
              setSelectedMember(null);
            }}
            isDanger
            confirmText="Chuyển quyền"
          />
        </>
      )}

      {/* Delete group confirm modal */}
      <ConfirmModal
        show={showConfirmDelete}
        title="Giải tán nhóm"
        message={`Bạn có chắc muốn giải tán nhóm "${groupInfo.name}"? Hành động này không thể hoàn tác và tất cả thành viên sẽ bị xóa khỏi nhóm.`}
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDeleteGroup?.();
          onClose();
        }}
        onCancel={() => setShowConfirmDelete(false)}
        isDanger
        confirmText="Giải tán nhóm"
      />
    </>
  );
};

export default GroupManagementModal;
