/**
 * Throttle utility - giới hạn số lần gọi function
 * Giúp giảm số lượng socket events
 */

export const throttle = (func: (...args: any[]) => void, delay: number) => {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: any[]) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else if (!timeoutId) {
      // Nếu chưa hết delay, schedule call cuối cùng
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  };
};

/**
 * Debounce utility - chỉ gọi function sau khi không gọi trong delay ms
 * Dùng cho search, resize, etc
 */
export const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};

export default { throttle, debounce };
