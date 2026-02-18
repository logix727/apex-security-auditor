import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SequenceEditor } from '../SequenceEditor';
import { RequestSequence } from '../../../types';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    ListOrdered: () => <div data-testid="icon-list" />,
    Play: () => <div data-testid="icon-play" />,
    Plus: () => <div data-testid="icon-plus" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Zap: () => <div data-testid="icon-zap" />,
    BrainCircuit: () => <div data-testid="icon-brain" />,
    Wand2: () => <div data-testid="icon-wand" />,
    RotateCcw: () => <div data-testid="icon-reset" />
}));

// Mock ReactMarkdown
vi.mock('react-markdown', () => ({
    default: ({ children }: any) => <div data-testid="markdown">{children}</div>
}));

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (cmd: string, _args: any) => mockInvoke(cmd, _args)
}));

// Mock DebugLogger
const mockInfo = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('../../debug/DebugConsole', () => ({
    useDebugLogger: () => ({
        info: mockInfo,
        success: mockSuccess,
        error: mockError
    })
}));

describe('SequenceEditor', () => {
    const mockSequences: RequestSequence[] = [
        { id: 'seq-1', flow_name: 'Login Flow', steps: [], created_at: '2023-01-01', context_summary: '' },
        { id: 'seq-2', flow_name: 'Checkout Flow', steps: [], created_at: '2023-01-02', context_summary: '' }
    ];

    const mockDetailedSequence: RequestSequence = {
        id: 'seq-1',
        flow_name: 'Login Flow',
        created_at: '2023-01-01',
        context_summary: 'Test summary',
        steps: [
            {
                id: 1,
                sequence_id: 'seq-1',
                asset_id: 1,
                method: 'POST',
                url: 'https://api.example.com/login',
                request_body: '{"user":"test"}',
                status_code: 200,
                response_body: '{"token":"abc"}',
                request_headers: null,
                response_headers: null,
                timestamp: '2023-01-01T10:00:00Z',
                captures: []
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockResolvedValue([]); 
    });

    it('loads and displays sequences on mount', async () => {
        mockInvoke.mockImplementation((cmd) => {
            if (cmd === 'list_sequences') return Promise.resolve(mockSequences);
            return Promise.resolve([]);
        });

        render(<SequenceEditor />);

        await waitFor(() => {
            expect(screen.getByText('Login Flow')).toBeInTheDocument();
            expect(screen.getByText('Checkout Flow')).toBeInTheDocument();
        });

        expect(mockInvoke).toHaveBeenCalledWith('list_sequences', undefined);
    });

    it('loads sequence details when clicked', async () => {
        mockInvoke.mockImplementation((cmd, args) => {
            if (cmd === 'list_sequences') return Promise.resolve(mockSequences);
            if (cmd === 'get_sequence' && args.id === 'seq-1') return Promise.resolve(mockDetailedSequence);
            return Promise.resolve([]);
        });

        render(<SequenceEditor />);

        await waitFor(() => screen.getByText('Login Flow'));
        fireEvent.click(screen.getByText('Login Flow'));

        await waitFor(() => {
            expect(screen.getByText('https://api.example.com/login')).toBeInTheDocument();
        });

        expect(mockInvoke).toHaveBeenCalledWith('get_sequence', { id: 'seq-1' });
    });

    it('adds a variable capture when Add button is clicked', async () => {
        mockInvoke.mockImplementation((cmd, _args) => {
            if (cmd === 'list_sequences') return Promise.resolve(mockSequences);
            if (cmd === 'get_sequence') return Promise.resolve(mockDetailedSequence);
            return Promise.resolve([]);
        });

        render(<SequenceEditor />);
        await waitFor(() => screen.getByText('Login Flow'));
        fireEvent.click(screen.getByText('Login Flow')); // Load details
        
        // Expand step details
        const stepRow = await screen.findByText('https://api.example.com/login');
        fireEvent.click(stepRow.parentElement!); // Click the row container or the div

        const addButton = await screen.findByRole('button', { name: /Add/i });
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(screen.getByDisplayValue('new_var')).toBeInTheDocument();
            expect(screen.getByDisplayValue('json:path.to.key')).toBeInTheDocument();
        });
    });

    it('executes a step when Play button is clicked', async () => {
        mockInvoke.mockImplementation((cmd, _args) => {
            if (cmd === 'list_sequences') return Promise.resolve(mockSequences);
            if (cmd === 'get_sequence') return Promise.resolve(mockDetailedSequence);
            if (cmd === 'execute_sequence_step') return Promise.resolve({
                status_code: 201,
                response_body: '{"success":true}',
                updated_context: { 'token': 'abc' }
            });
            return Promise.resolve([]);
        });

        render(<SequenceEditor />);
        await waitFor(() => screen.getByText('Login Flow'));
        fireEvent.click(screen.getByText('Login Flow')); 

        const playButtons = await screen.findAllByTestId('icon-play');
        // First play button is likely "Run All" in header, second is in step row
        const stepPlayBtn = playButtons[1].parentElement!;
        
        fireEvent.click(stepPlayBtn);

        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('execute_sequence_step', expect.objectContaining({
                step: expect.objectContaining({ method: 'POST' })
            }));
            expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('Step 1 completed'), 'Sequences');
        });
    });
});
