/**
 * Logger utility - chỉ log khi development
 * Giúp tối ưu hiệu suất production
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (message: string, data?: any) => {
    if (isDev) {
      console.log(`📝 ${message}`, data);
    }
  },

  info: (message: string, data?: any) => {
    if (isDev) {
      console.info(`ℹ️ ${message}`, data);
    }
  },

  warn: (message: string, data?: any) => {
    console.warn(`⚠️ ${message}`, data);
  },

  error: (message: string, error?: any) => {
    console.error(`❌ ${message}`, error);
  },

  debug: (message: string, data?: any) => {
    if (isDev) {
      console.debug(`🐛 ${message}`, data);
    }
  },

  performance: (label: string, startTime: number) => {
    if (isDev) {
      const duration = performance.now() - startTime;
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }
  },
};

export default logger;
