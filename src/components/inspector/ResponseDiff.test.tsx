import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponseDiff } from '../common/ResponseDiff';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(() => Promise.resolve([
        { content: 'line1', tag: 'Equal' },
        { content: 'line2', tag: 'Insert' }
    ]))
}));

describe('ResponseDiff', () => {
    it('renders the diff view', async () => {
        const oldContent = '{"a":1}';
        const newContent = '{"a":2}';

        render(<ResponseDiff old={oldContent} new={newContent} />);

        // It starts with loading
        expect(screen.getByText(/Calculating Diff/i)).toBeInTheDocument();

        // Wait for diff lines to appear
        const line1 = await screen.findByText(/line1/i);
        expect(line1).toBeInTheDocument();
        expect(screen.getByText(/line2/i)).toBeInTheDocument();
    });
});
