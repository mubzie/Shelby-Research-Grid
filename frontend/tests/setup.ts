import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Polyfill TextEncoder/TextDecoder for jsdom (used by React Router)
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Polyfill fetch for jsdom (node's global fetch is not exposed in the sandbox)
if (typeof global.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('whatwg-fetch')
}

// jsdom's crypto stub has no subtle — use node's WebCrypto for AES-GCM tests
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('node:crypto') as { webcrypto: Crypto }
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
