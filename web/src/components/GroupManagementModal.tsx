import { useState, useEffect } from 'react';
import {
  FaTimes, FaUserShield, FaTrash, FaSearch, FaCrown, FaUserPlus,
  FaEdit, FaImage, FaCheck, FaEllipsisV, FaInfoCircle, FaCopy, FaShare,
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

interface GroupInfo {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
  members: GroupMember[];
  memberCount: number;
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

  const handleToggleSetting = (key: keyof GroupSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Đã cập nhật cài đặt');
  };

  const handleTogglePermission = (key: keyof typeof memberPermissions) => {
    setMemberPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Đã cập nhật quyền');
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
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-gray-700 rounded-full transition-colors"
            >
              <FaTimes />
            </button>
            <h2 className="text-lg font-bold text-white flex-1">Quản lý nhóm</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'settings' && (
              <div className="text-white">
                {/* Cho phép các thành viên trong nhóm */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Cho phép các thành viên trong nhóm:</h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-white">Thay đổi tên & ảnh đại diện của nhóm</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.changeNameAvatar}
                        onChange={() => handleTogglePermission('changeNameAvatar')}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className="flex items-start justify-between cursor-pointer">
                      <span className="text-sm text-white flex-1 pr-3">Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.pinMessages}
                        onChange={() => handleTogglePermission('pinMessages')}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-white">Tạo mới ghi chú, nhắc hẹn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.createNotes}
                        onChange={() => handleTogglePermission('createNotes')}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-white">Tạo mới bình chọn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.createPolls}
                        onChange={() => handleTogglePermission('createPolls')}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-white">Gửi tin nhắn</span>
                      <input
                        type="checkbox"
                        checked={memberPermissions.sendMessages}
                        onChange={() => handleTogglePermission('sendMessages')}
                        className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors
                          before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                          checked:before:translate-x-5"
                      />
                    </label>
                  </div>
                </div>

                {/* Chế độ phê duyệt thành viên mới */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className="flex items-start justify-between cursor-pointer">
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
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Đánh dấu tin nhắn từ trưởng/phó nhóm */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className="flex items-start justify-between cursor-pointer">
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
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Cho phép thành viên mới đọc tin nhắn gần nhất */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className="flex items-start justify-between cursor-pointer">
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
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0
                        before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform
                        checked:before:translate-x-5"
                    />
                  </label>
                </div>

                {/* Cho phép dùng link tham gia nhóm */}
                <div className="px-4 py-4 border-b border-gray-700">
                  <label className="flex items-start justify-between cursor-pointer mb-3">
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
                      className="w-11 h-6 bg-gray-600 rounded-full relative appearance-none cursor-pointer checked:bg-blue-500 transition-colors shrink-0
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
                <button
                  onClick={() => toast('Tính năng đang phát triển')}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-700/50 transition-colors border-b border-gray-700"
                >
                  <FaUsers className="text-white text-lg" />
                  <span className="text-sm text-white">Chặn khỏi nhóm</span>
                </button>

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

            {tab === 'members' && (
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
