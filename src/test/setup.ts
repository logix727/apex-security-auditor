
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Use globalThis to avoid direct vitest import in setup
declare global {
  namespace Vi {
    interface Matchers<T> extends jest.Matchers<T> {}
  }
}

// Try to get afterEach from vitest if available
const afterEach = (globalThis as any).afterEach || ((cb: () => void) => { 
  if (typeof afterEach !== 'function') return;
});

// Clear RTL state after each test
if (typeof afterEach === 'function') {
  afterEach(() => {
    cleanup();
  });
}

// Mock Worker for JSDOM
class WorkerMock {
  url: string;
  onmessage: (msg: any) => void = () => {};
  constructor(stringUrl: string) {
    this.url = stringUrl;
  }
  postMessage(msg: any) {
    if (msg.type === 'PROCESS_ASSETS') {
      setTimeout(() => this.onmessage({ 
        data: { type: 'PROCESS_ASSETS_COMPLETE', data: msg.data } 
      }), 0);
    } else {
      setTimeout(() => this.onmessage({ data: msg }), 0);
    }
  }
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

(globalThis as any).Worker = WorkerMock;
