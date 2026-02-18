import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AssetProvider, useAsset } from '../../../../src/context/AssetContext';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('AssetContext', () => {
  const TestComponent: React.FC = () => {
    const { state } = useAsset();
    return (
      <div>
        <div data-testid="assets-count">{state.assets.length}</div>
        <div data-testid="loading">{state.isLoading.toString()}</div>
      </div>
    );
  };

  it('provides initial state', () => {
    render(
      <AssetProvider>
        <TestComponent />
      </AssetProvider>
    );

    expect(screen.getByTestId('assets-count')).toHaveTextContent('0');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});