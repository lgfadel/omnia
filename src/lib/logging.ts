// Production-safe logging utilities
export const logger = {
  // Development-only logging
  debug: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data)
    }
  },
  
  // Error logging (always shown)
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${message}`, error)
  },
  
  // Warning logging (always shown)
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${message}`, data)
  },
  
  // Info logging (always shown)
  info: (message: string, data?: unknown) => {
    console.info(`[INFO] ${message}`, data)
  }
}