// Production-safe logging utilities
export const logger = {
  // Development-only logging
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data)
    }
  },
  
  // Error logging (always shown)
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error)
  },
  
  // Warning logging (always shown)
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data)
  },
  
  // Info logging (always shown)
  info: (message: string, data?: any) => {
    console.info(`[INFO] ${message}`, data)
  }
}