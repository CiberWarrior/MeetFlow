/**
 * Rate Limiting Utility
 * Supports both Upstash Redis (cloud) and local Redis
 * 
 * Priority:
 * 1. Upstash Redis (if UPSTASH_REDIS_REST_URL is set)
 * 2. Local Redis (if REDIS_HOST is set)
 * 3. Disabled (if neither is configured - fail-open)
 * 
 * Different rate limits for different endpoints:
 * - Login: 5 attempts per 15 minutes
 * - Registration: 3 attempts per hour
 * - Payment Intent: 10 attempts per minute
 * - API Routes (authenticated): 100 requests per minute
 * - API Routes (public): 50 requests per minute
 * - Abstract Upload: 5 uploads per minute
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
// Uses Upstash Redis (cloud service that works with ANY hosting)
// 
// IMPORTANT: Upstash works with:
// - Vercel (serverless)
// - VPS (DigitalOcean, AWS EC2, etc.)
// - Dedicated servers
// - Any hosting provider
//
// It's a cloud service (like Supabase) - communicates via HTTP REST API
// No need to install anything on your server!

let redis: Redis | null = null
let isConfigured = false

try {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    isConfigured = true
  }
} catch (error) {
  console.warn('Upstash Redis not configured, rate limiting disabled')
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return 'unknown'
}

/**
 * Login rate limiter: 5 attempts per 15 minutes
 */
export const loginRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/login',
    })
  : null

/**
 * Registration rate limiter: 3 attempts per hour
 */
export const registrationRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      analytics: true,
      prefix: '@upstash/ratelimit/registration',
    })
  : null

/**
 * Payment Intent rate limiter: 10 attempts per minute
 */
export const paymentIntentRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/payment-intent',
    })
  : null

/**
 * API rate limiter (authenticated): 100 requests per minute
 */
export const apiRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/api',
    })
  : null

/**
 * Public API rate limiter: 50 requests per minute
 */
export const publicApiRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/public-api',
    })
  : null

/**
 * Abstract upload rate limiter: 5 uploads per minute
 */
export const abstractUploadRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/abstract-upload',
    })
  : null

/**
 * Abstract online form submit rate limiter: 60 submissions per 5 minutes
 */
export const abstractOnlineSubmitRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '5 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/abstract-online-submit',
    })
  : null

/**
 * Abstract document submit rate limiter: 20 submissions per 5 minutes
 */
export const abstractDocumentSubmitRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '5 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/abstract-document-submit',
    })
  : null

/**
 * Abstract revision document upload rate limiter: 5 uploads per 10 minutes
 */
export const abstractRevisionUploadRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/abstract-revision-upload',
    })
  : null

/**
 * Registration attachment upload rate limiter: 5 uploads per minute
 */
export const registrationAttachmentRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/registration-attachment',
    })
  : null

/**
 * Email lookup rate limiter: 10 lookups per minute
 * Protects endpoints that check whether an email exists (enumeration attacks)
 */
export const emailLookupRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/email-lookup',
    })
  : null

/**
 * Public contact form rate limiter: 5 messages per hour per IP
 * Applies to /api/contact and /api/conferences/[slug]/contact
 */
export const contactRateLimit = isConfigured && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
      prefix: '@upstash/ratelimit/contact',
    })
  : null

/**
 * Helper function to check rate limit
 * Returns null if rate limiting is disabled or not configured
 */
export async function checkRateLimit(
  rateLimiter: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
} | null> {
  if (!rateLimiter || !isConfigured) {
    // Rate limiting disabled, allow request
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Date.now() + 60000,
    }
  }

  try {
    const result = await rateLimiter.limit(identifier)
    return result
  } catch (error) {
    // If rate limiting fails, allow request (fail open)
    console.error('Rate limit check failed:', error)
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Date.now() + 60000,
    }
  }
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: {
  success: boolean
  limit: number
  remaining: number
  reset: number
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.success
      ? {}
      : {
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        }),
  }
}

