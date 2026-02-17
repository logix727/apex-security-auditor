
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Clear RTL state after each test
afterEach(() => {
  cleanup();
});
