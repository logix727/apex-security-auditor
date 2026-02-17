import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Inspector, InspectorTab } from './Inspector';
import { Asset } from '../types';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

// Mock sub-components to reduce complexity for unit testing Inspector
vi.mock('./JSONTree', () => ({
    JSONTree: () => <div data-testid="json-tree">JSON Tree</div>
}));
vi.mock('./HeaderView', () => ({
    HeaderView: () => <div data-testid="header-view">Header View</div>
}));
vi.mock('./summary', () => ({
    KPICard: () => <div>KPI Card</div>,
    SeverityChart: () => <div>Severity Chart</div>,
    FindingsGroup: () => <div>Findings Group</div>,
    AssetMetadata: () => <div>Asset Metadata</div>
}));

describe('Inspector', () => {
    const mockAsset: Asset = {
        id: 1,
        url: 'https://api.example.com/v1/users',
        method: 'GET',
        status: 'warning',
        status_code: 200,
        risk_score: 50,
        findings: [
            { short: 'BOLA', severity: 'Medium', description: 'Broken Object Level Authorization', emoji: '🔒' }
        ],
        folder_id: 1,
        response_time_ms: 150,
        content_type: 'application/json',
        request_headers: JSON.stringify({ 'Authorization': 'Bearer token' }),
        request_body: '',
        response_headers: JSON.stringify({ 'Content-Type': 'application/json' }),
        response_body: JSON.stringify({ users: [] }),
        source: 'Discovery',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: '',
        triage_status: 'open',
        is_documented: false
    } as any;

    const mockProps = {
        inspectorAsset: mockAsset,
        workbenchSummary: { total_findings: 1, high: 0, medium: 1, low: 0, info: 0 },
        activeInspectorTab: 'Summary' as InspectorTab,
        setActiveInspectorTab: vi.fn(),
        bodySearchTerm: '',
        setBodySearchTerm: vi.fn(),
        handleRescan: vi.fn(),
        showInspector: true,
        inspectorWidth: 400,
        selectedIdsCount: 1,
        activeView: 'workbench',
        decodedJwt: null,
        setDecodedJwt: vi.fn(),
        onRefresh: vi.fn()
    };

    it('should have 0 width if showInspector is false', () => {
        render(<Inspector {...mockProps} showInspector={false} />);
        const aside = screen.getByRole('complementary', { hidden: true });
        expect(aside).toHaveStyle('width: 0px');
    });

    it('should render summary tab by default', () => {
        render(<Inspector {...mockProps} />);
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByText(/AI AUDIT INSIGHT/)).toBeInTheDocument();
        expect(screen.getAllByText('KPI Card').length).toBeGreaterThan(0);
    });

    it('should call setActiveInspectorTab when clicking a tab', async () => {
        render(<Inspector {...mockProps} />);
        const exchangeTab = screen.getByText('Exchange');
        await act(async () => {
            fireEvent.click(exchangeTab);
        });
        expect(mockProps.setActiveInspectorTab).toHaveBeenCalledWith('Exchange');
    });

    it('should render Exchange tab content when active', () => {
        render(<Inspector {...mockProps} activeInspectorTab="Exchange" />);
        expect(screen.getAllByTestId('header-view')[0]).toBeInTheDocument();
        expect(screen.getByTestId('json-tree')).toBeInTheDocument();
    });

    it('should render Security tab content when active', () => {
        render(<Inspector {...mockProps} activeInspectorTab="Security" />);
        expect(screen.getByText(/Authentication Status/)).toBeInTheDocument();
        expect(screen.getByText(/Discovered Tokens/)).toBeInTheDocument();
    });

    it('should render Details tab content when active', () => {
        render(<Inspector {...mockProps} activeInspectorTab="Details" />);
        expect(screen.getByText(/Asset Details/)).toBeInTheDocument();
        expect(screen.getByText(/Scan History/)).toBeInTheDocument();
    });

    it('should show "Workbench Overview" when inspectorAsset is null but summary exists', () => {
        render(<Inspector {...mockProps} inspectorAsset={null} />);
        expect(screen.getByText(/Workbench Overview/)).toBeInTheDocument();
    });
});
