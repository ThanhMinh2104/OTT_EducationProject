import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

/**
 * Fetch user info với error handling
 * Trả về user info hoặc fallback nếu user không tồn tại
 */
export const fetchUserInfo = async (userID: string) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/usersID`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ userID }),
    });

    if (!res.ok) {
      if (res.status === 404) {
        // User không tồn tại, trả về fallback data
        console.warn(`User ${userID} not found`);
        return {
          userID,
          name: 'Người dùng đã xóa',
          anhDaiDien: null,
          email: '',
        };
      }
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error(`Error fetching user info for ${userID}:`, err);
    // Trả về fallback data thay vì throw error
    return {
      userID,
      name: 'Người dùng đã xóa',
      anhDaiDien: null,
      email: '',
    };
  }
};

/**
 * Fetch friend status với error handling
 */
export const fetchFriendStatus = async (userID: string) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/contacts/friend-status/${userID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!res.ok) {
      console.warn(`Could not fetch friend status for ${userID}`);
      return { friendStatus: 'none' };
    }

    return await res.json();
  } catch (err: any) {
    console.error(`Error fetching friend status for ${userID}:`, err);
    return { friendStatus: 'none' };
  }
};
