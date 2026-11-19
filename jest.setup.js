// Jest setup file
// Add any global test configuration here

import { TextDecoder, TextEncoder } from 'util'

// jsPDF (node build) needs TextEncoder in the Jest environment
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Polyfill fetch for jsdom (not available in Jest/jsdom by default)
globalThis.fetch = globalThis.fetch || jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

// Extend Jest matchers
import '@testing-library/jest-dom'
