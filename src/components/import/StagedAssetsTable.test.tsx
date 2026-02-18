import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StagedAssetsTable } from './StagedAssetsTable';
import { ImportAsset } from '../../types';

describe('StagedAssetsTable', () => {
  const mockAssets: ImportAsset[] = [
    {
      id: 'asset-1',
      url: 'https://example.com/1',
      method: 'GET',
      source: 'test',
      selected: true,
      recursive: false,
      status: 'valid'
    },
    {
      id: 'asset-2',
      url: 'https://example.com/2',
      method: 'POST',
      source: 'test',
      selected: false,
      recursive: true,
      status: 'valid'
    }
  ];

  it('renders assets correctly', () => {
    const onToggleSelection = vi.fn();
    const onToggleRecursive = vi.fn();
    const onRemove = vi.fn();
    const onToggleAll = vi.fn();

    render(
      <StagedAssetsTable
        assets={mockAssets}
        onToggleSelection={onToggleSelection}
        onToggleRecursive={onToggleRecursive}
        onRemove={onRemove}
        onToggleAll={onToggleAll}
      />
    );

    expect(screen.getByText('https://example.com/1')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/2')).toBeInTheDocument();
  });

  it('calls onToggleRecursive when Rec checkbox is clicked', () => {
    const onToggleSelection = vi.fn();
    const onToggleRecursive = vi.fn();
    const onRemove = vi.fn();
    const onToggleAll = vi.fn();

    render(
      <StagedAssetsTable
        assets={mockAssets}
        onToggleSelection={onToggleSelection}
        onToggleRecursive={onToggleRecursive}
        onRemove={onRemove}
        onToggleAll={onToggleAll}
      />
    );

    // Find checkboxes. The "Rec" checkbox is the second one in the row (after selection).
    // Better to find by title or role.
    const checkboxes = screen.getAllByTitle('Recursive Discovery');
    expect(checkboxes).toHaveLength(2);

    // Click the first one (asset-1)
    fireEvent.click(checkboxes[0]);
    expect(onToggleRecursive).toHaveBeenCalledWith('asset-1');

    // Click the second one (asset-2)
    fireEvent.click(checkboxes[1]);
    expect(onToggleRecursive).toHaveBeenCalledWith('asset-2');
  });

  it('calls onToggleSelection when selection checkbox is clicked', () => {
    const onToggleSelection = vi.fn();
    const onToggleRecursive = vi.fn();
    const onRemove = vi.fn();
    const onToggleAll = vi.fn();

    render(
      <StagedAssetsTable
        assets={mockAssets}
        onToggleSelection={onToggleSelection}
        onToggleRecursive={onToggleRecursive}
        onRemove={onRemove}
        onToggleAll={onToggleAll}
      />
    );

    // Selection checkboxes don't have a unique title in the code I viewed, 
    // but they are the first input of type checkbox in the row.
    // Actually, looking at the code:
    // Selection: <input type="checkbox" checked={item.selected} onChange={() => onToggleSelection(item.id)} />
    // Rec: <input type="checkbox" checked={item.recursive} title="Recursive Discovery" ... />
    
    // We can select by excluding the ones with title "Recursive Discovery" and the header checkbox.
    const allCheckboxes = screen.getAllByRole('checkbox');
    // Header (1) + 2 rows * 2 checkboxes = 5 checkboxes.
    
    // Let's assume the order is Header, Row1-Select, Row1-Rec, Row2-Select, Row2-Rec.
    // Row1-Select is index 1.
    fireEvent.click(allCheckboxes[1]);
    expect(onToggleSelection).toHaveBeenCalledWith('asset-1');
  });
});
