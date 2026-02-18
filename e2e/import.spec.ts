import { test, expect } from '@playwright/test';

test('import functionality', async ({ page }) => {
  // Mock Tauri IPC
  await page.addInitScript(() => {
    // Determine the mock function
    const mockInvoke = async (cmd: string, args: any) => {
      console.log(`[Mock] Invoke: ${cmd}`, args);
      
      if (cmd === 'get_assets') return [];
      if (cmd === 'get_folders') return [];
      if (cmd === 'validate_urls') {
        return (args.urls || []).map((url: string) => ({
          url,
          is_valid: true,
          message: 'Valid'
        }));
      }
      if (cmd === 'import_staged_assets') {
          return { ids: [101], errors: [] };
      }
      
      return null;
    };

    // Inject into possible Tauri globals
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

  await page.goto('/');
  await page.waitForTimeout(1000);

  // 1. Open Import Modal
  // Use first() to avoid ambiguity if multiple "Import Assets" inputs exist (e.g. empty state + header)
  await page.getByText('Import Assets').first().click();

  // 2. Enter URL
  const textArea = page.getByPlaceholder('Paste URLs, JSON arrays, or raw HTTP requests...');
  await expect(textArea).toBeVisible();
  await textArea.fill('https://example.com');

  // 3. Process
  await page.getByRole('button', { name: 'Process Staged Text' }).click();

  // 4. Verification
  // Wait for staging table to populate
  await expect(page.getByText('example.com')).toBeVisible();

  // 5. Confirm Import
  await page.getByRole('button', { name: 'Confirm Import' }).click();

  // 6. Success check
  // Toast or notification
  await expect(page.getByText(/Imported 1 assets/i)).toBeVisible();
});
