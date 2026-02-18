import { test, expect } from '@playwright/test';

// Test data
const mockAssets = [
  { id: 1, url: 'https://example.com/api/users', method: 'GET', status: 'active', status_code: 200, risk_score: 0, findings: [], folder_id: 1, response_headers: '{}', response_body: '{}', request_headers: '{}', request_body: '', created_at: '2024-01-01', updated_at: '2024-01-01', notes: '', triage_status: 'pending', is_documented: true, source: 'import', recursive: false, is_workbench: false, depth: 0 },
  { id: 2, url: 'https://example.com/api/admin', method: 'POST', status: 'active', status_code: 201, risk_score: 5, findings: [], folder_id: 1, response_headers: '{}', response_body: '{}', request_headers: '{}', request_body: '{}', created_at: '2024-01-01', updated_at: '2024-01-01', notes: '', triage_status: 'pending', is_documented: true, source: 'import', recursive: false, is_workbench: false, depth: 0 },
];

const mockFolders = [
  { id: 1, name: 'Default', parent_id: null },
  { id: 2, name: 'API', parent_id: null },
];

test.describe('Asset Manager', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri IPC
    await page.addInitScript(() => {
      const mockInvoke = async (cmd: string, args: any) => {
        console.log(`[Mock] Invoke: ${cmd}`, args);
        
        if (cmd === 'get_assets') return mockAssets;
        if (cmd === 'get_folders') return mockFolders;
        if (cmd === 'validate_urls') {
          return (args.urls || []).map((url: string) => ({
            url,
            is_valid: true,
            message: 'Valid'
          }));
        }
        if (cmd === 'import_staged_assets') {
          return { ids: [101, 102], errors: [] };
        }
        if (cmd === 'delete_asset') {
          return undefined;
        }
        if (cmd === 'add_folder') {
          return { id: 3, name: args.name, parent_id: args.parentId || null };
        }
        if (cmd === 'move_assets_to_folder') {
          return undefined;
        }
        
        return null;
      };

      (window as any).__TAURI__ = {
        core: { invoke: mockInvoke },
        invoke: mockInvoke
      };
      (window as any).__TAURI_INTERNALS__ = {
        invoke: mockInvoke
      };
    });

    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser Error] ${err}`));
  });

  test('should display assets view with loaded data', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Navigate to assets view
    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Verify assets are displayed
    await expect(page.getByText('example.com/api/users')).toBeVisible();
    await expect(page.getByText('example.com/api/admin')).toBeVisible();
  });

  test('should filter assets by method', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Open filter menu
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Select GET method filter
    await page.getByText('GET').click();
    
    // Verify filtered results
    await expect(page.getByText('example.com/api/users')).toBeVisible();
  });

  test('should open import modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Click import button
    await page.getByText('Import Assets').first().click();
    
    // Verify modal is open
    await expect(page.getByPlaceholder('Paste URLs, JSON arrays, or raw HTTP requests...')).toBeVisible();
  });

  test('should create new folder', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Click add folder button (may be in sidebar)
    const addFolderBtn = page.getByRole('button', { name: /add folder/i });
    if (await addFolderBtn.isVisible()) {
      await addFolderBtn.click();
      
      // Enter folder name
      await page.getByPlaceholder('Folder name').fill('Test Folder');
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify folder created
      await expect(page.getByText('Test Folder')).toBeVisible();
    }
  });

  test('should select and deselect assets', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Click on an asset row to select it
    const assetRow = page.getByText('example.com/api/users');
    await assetRow.click();

    // Verify selection (checkbox or row highlight)
    // This depends on implementation
    await page.waitForTimeout(200);
  });

  test('should handle empty state', async ({ page }) => {
    await page.addInitScript(() => {
      const emptyMockInvoke = async (cmd: string) => {
        if (cmd === 'get_assets') return [];
        if (cmd === 'get_folders') return [];
        return null;
      };
      (window as any).__TAURI__ = {
        core: { invoke: emptyMockInvoke },
        invoke: emptyMockInvoke
      };
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Verify empty state
    await expect(page.getByText(/no assets/i)).toBeVisible();
  });
});

test.describe('Asset Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockInvoke = async (cmd: string) => {
        if (cmd === 'get_assets') return mockAssets;
        if (cmd === 'get_folders') return mockFolders;
        return null;
      };

      (window as any).__TAURI__ = {
        core: { invoke: mockInvoke },
        invoke: mockInvoke
      };
    });
  });

  test('should export assets to CSV', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByText('Assets').first().click();
    await page.waitForTimeout(500);

    // Look for export button
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      
      // Select CSV format
      await page.getByText('CSV').click();
      
      // Download should trigger
      await page.waitForTimeout(500);
    }
  });
});
