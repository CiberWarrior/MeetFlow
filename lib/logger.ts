/**
 * Logger utility with security features
 * - Masks sensitive data (emails, passwords, tokens)
 * - Different behavior in development vs production
 * - Structured JSON logging for production
 * - Colorized console output for development
 * - Server-only: Uses Winston (Node.js fs module)
 * - Client-safe: Falls back to console in browser
 */

// Check if we're in a browser environment or Edge Runtime
const isBrowser = typeof window !== 'undefined'
// EdgeRuntime is a global in Edge Runtime, but TypeScript doesn't know about it
const isEdgeRuntime = typeof (globalThis as any).EdgeRuntime !== 'undefined'
const isServer = !isBrowser && !isEdgeRuntime

// Only import winston on the server (not in browser or Edge Runtime)
let winston: any = null
let logger: any = null

if (isServer) {
  try {
    // Dynamic import to prevent bundling in client
    winston = require('winston')
  } catch (error) {
    // Winston not available, will use console fallback
  }
}

// Mask sensitive data functions
function maskEmail(email: string | null | undefined): string {
  if (!email) return 'N/A'
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return `***@${domain}`
  return `${local[0]}***@${domain}`
}

function maskSensitive(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => maskSensitive(item))
  }

  const masked = { ...data }

  // Mask email fields
  if (masked.email) {
    masked.email = maskEmail(masked.email)
  }
  if (masked.userEmail) {
    masked.userEmail = maskEmail(masked.userEmail)
  }

  // Mask password fields
  if (masked.password) {
    masked.password = '***'
  }

  // Mask tokens
  if (masked.token) {
    masked.token = '***'
  }
  if (masked.access_token) {
    masked.access_token = '***'
  }
  if (masked.refresh_token) {
    masked.refresh_token = '***'
  }
  if (masked.token_hash) {
    masked.token_hash = '***'
  }
  if (masked.hashed_token) {
    masked.hashed_token = '***'
  }
  if (masked.email_otp) {
    masked.email_otp = '***'
  }
  if (masked.action_link) {
    masked.action_link = '***'
  }
  if (masked.activationUrl) {
    masked.activationUrl = '***'
  }
  if (masked.activation_url) {
    masked.activation_url = '***'
  }
  if (masked.apiKey) {
    masked.apiKey = '***'
  }
  if (masked.secret) {
    masked.secret = '***'
  }

  // Mask credit card info
  if (masked.cardNumber) {
    masked.cardNumber = '***'
  }
  if (masked.cvv) {
    masked.cvv = '***'
  }

  // Recursively mask nested objects
  Object.keys(masked).forEach(key => {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitive(masked[key])
    }
  })

  return masked
}

// Create logger instance (server-only)
if (!isBrowser && winston) {
  try {
    logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'conference-platform',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        // Development: Console with colors
        ...(process.env.NODE_ENV === 'development'
          ? [
              new winston.transports.Console({
                format: winston.format.combine(
                  winston.format.colorize(),
                  winston.format.printf(({ level, message, timestamp, ...meta }: any) => {
                    const metaStr =
                      Object.keys(meta).length > 0
                        ? ` ${JSON.stringify(maskSensitive(meta), null, 2)}`
                        : ''
                    return `${timestamp} ${level}: ${message}${metaStr}`
                  })
                ),
              }),
            ]
          : []),
        // Production: File logging
        ...(process.env.NODE_ENV === 'production'
          ? [
              new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
              }),
              new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
              }),
            ]
          : []),
      ],
    })
  } catch (error) {
    // Winston initialization failed, will use console fallback
    console.warn('Winston logger initialization failed, using console fallback')
  }
}

// Helper functions for different log levels
// Falls back to console in browser environment
export const log = {
  /**
   * Debug level - only in development
   * Use for detailed debugging information
   */
  debug: (message: string, meta?: any) => {
    if (logger) {
      logger.debug(message, maskSensitive(meta))
    } else if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, maskSensitive(meta))
    }
  },

  /**
   * Info level - general information
   * Use for normal operations (user actions, successful operations)
   */
  info: (message: string, meta?: any) => {
    if (logger) {
      logger.info(message, maskSensitive(meta))
    } else {
      console.info(`[INFO] ${message}`, maskSensitive(meta))
    }
  },

  /**
   * Warn level - warnings
   * Use for potentially harmful situations
   */
  warn: (message: string, meta?: any) => {
    if (logger) {
      logger.warn(message, maskSensitive(meta))
    } else {
      console.warn(`[WARN] ${message}`, maskSensitive(meta))
    }
  },

  /**
   * Error level - errors
   * Use for error events that might still allow the app to continue
   */
  error: (message: string, error?: Error | any, meta?: any) => {
    const errorMeta = {
      ...maskSensitive(meta),
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
              name: error.name,
            }
          : error,
    }
    
    if (logger) {
      logger.error(message, errorMeta)
    } else {
      console.error(`[ERROR] ${message}`, errorMeta)
    }
  },
}

export default logger

