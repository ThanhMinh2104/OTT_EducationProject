import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

interface Props {
  user: { userID: string; name: string; avatar?: string };
  currentAlias: string;
  onClose: () => void;
  onSave: (newAlias: string) => void;
}

const AliasModal = ({ user, currentAlias, onClose, onSave }: Props) => {
  const [alias, setAlias] = useState(currentAlias);

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-['Segoe_UI',sans-serif]">
      <div className="bg-[#242526] w-full max-w-[400px] rounded-lg shadow-2xl flex flex-col text-gray-900 animate-modal-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-[17px] font-bold">Đặt tên gợi nhớ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          <img 
            src={user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID} 
            className="w-24 h-24 rounded-full border-2 border-gray-600 mb-6 object-cover"
            alt="avatar"
          />
          
          <div className="text-center space-y-2 mb-6 px-2">
            <p className="text-[15px]">
              Hãy đặt cho <span className="font-bold">{user.name}</span> một cái tên dễ nhớ.
            </p>
            <p className="text-[14px] text-gray-400">
              Lưu ý: Tên gợi nhớ sẽ chỉ hiển thị riêng với bạn.
            </p>
          </div>

          <input 
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="w-full bg-[#3a3b3c] border border-gray-600 rounded-md px-4 py-2.5 text-[15px] outline-none focus:border-blue-500 transition-all mb-4"
            placeholder="Nhập tên gợi nhớ..."
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-4 border-t border-gray-700">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-md font-bold text-[14.5px] bg-gray-100 hover:bg-gray-600 transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={() => onSave(alias)}
            className="px-6 py-2 rounded-md font-bold text-[14.5px] bg-[#0068FF] hover:bg-blue-600 transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default AliasModal;
