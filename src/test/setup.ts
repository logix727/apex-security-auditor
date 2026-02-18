
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Use globalThis to avoid direct vitest import in setup
declare global {
  namespace Vi {
    interface Matchers<T> extends jest.Matchers<T> {}
  }
}

// Try to get afterEach from vitest if available
const afterEach = globalThis.afterEach || ((cb: () => void) => { 
  if (typeof afterEach !== 'function') return;
});

// Clear RTL state after each test
if (typeof afterEach === 'function') {
  afterEach(() => {
    cleanup();
  });
}
