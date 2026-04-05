export const getToken = (): string | null => sessionStorage.getItem('token');

export const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};