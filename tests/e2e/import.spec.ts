
import { test, expect } from '@playwright/test';

test.describe('Import functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load, sidebar might take a moment but let's wait for header
    await expect(page.locator('.header')).toBeVisible();
  });

  test('should open import modal via header button and import text', async ({ page }) => {
    // 1. Click "Import Assets"
    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.menu-item'));
        const importBtn = items.find(el => el.textContent?.includes('Import Assets'));
        if (importBtn) (importBtn as HTMLElement).click();
    });
    
    // 2. Check for modal
    await expect(page.getByRole('heading', { name: 'Import Assets', exact: true })).toBeVisible();
    
    // 3. Enter text directly (no tabs anymore)
    const textarea = page.locator('textarea');
    await textarea.fill('https://example.com/api/test-import GET');
    
    // 4. Click Process
    await page.getByRole('button', { name: 'Process Staged Text' }).click();
    
    // 5. Verify staged asset appears in the review table
    await expect(page.getByText('https://example.com/api/test-import')).toBeVisible();
    
    // 6. Confirm Import
    await page.getByRole('button', { name: 'Confirm Import' }).click();
    
    // 7. Modal should close
    await expect(page.getByText('Import Assets')).not.toBeVisible();
  });

  test('should open import modal on file drop', async ({ page }) => {
    // Create a dummy file
    const buffer = Buffer.from('https://dropped.com/api/v1 GET');
    
    // Trigger drop event on body
    const dataTransfer = await page.evaluateHandle((data) => {
        const dt = new DataTransfer();
        const file = new File([data], 'import.txt', { type: 'text/plain' });
        dt.items.add(file);
        return dt;
    }, buffer.toString());

    await page.dispatchEvent('body', 'drop', { dataTransfer });

    // Expect modal to open
    await expect(page.getByRole('heading', { name: 'Import Assets', exact: true })).toBeVisible();
    
    await expect(page.getByText('https://dropped.com/api/v1')).toBeVisible();
  });
});
