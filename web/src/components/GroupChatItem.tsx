import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';

interface GroupChatItemProps {
  groupID: string;
  isSelected: boolean;
  onSelect: (groupID: string) => void;
}

export const GroupChatItem: React.FC<GroupChatItemProps> = ({ groupID, isSelected, onSelect }) => {
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroup();
  }, [groupID]);

  const fetchGroup = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}`);
      setGroup(response.data);
    } catch (error) {
      console.error('Error fetching group:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !group) {
    return null;
  }

  return (
    <div
      className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b border-gray-50 relative transition-colors group ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={() => onSelect(groupID)}
    >
      <div className="relative mr-3 shrink-0">
        <div className="w-[46px] h-[46px] rounded-full object-cover bg-gradient-to-br from-blue-400 to-purple-500 shadow-sm flex items-center justify-center text-white font-bold text-lg">
          {group.name.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden gap-0.5 min-w-0">
        <p className="text-[14.5px] font-semibold text-gray-900 m-0 truncate">
          👥 {group.name}
        </p>
        <p className="text-[13px] text-gray-400 m-0 truncate">
          {group.members?.length || 0} thành viên
        </p>
      </div>
    </div>
  );
};
