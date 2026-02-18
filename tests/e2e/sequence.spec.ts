
import { test, expect } from '@playwright/test';

test.describe('Sequence Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await expect(page.locator('.header')).toBeVisible();
  });

  test('should load sequences and allow editing variables', async ({ page }) => {
    // 1. Navigate to Sequences view
    // Sidebar item with text 'Sequences'
    await page.locator('.nav-item', { hasText: 'Sequences' }).click();

    // 2. Verify we are in sequences view
    // Check for sidebar title or specific element in SequenceEditor
    // The sequence list is on the left.
    // We mocked 'list_sequences' to return 'Mock Flow'.
    await expect(page.getByText('Mock Flow')).toBeVisible();

    // 3. Select the sequence
    await page.getByText('Mock Flow').click();

    // 4. Verify details loaded
    // Header with flow name
    await expect(page.getByRole('heading', { name: 'Mock Flow' })).toBeVisible();
    
    // 5. Expand the first step
    // The step shows the URL
    await page.getByText('https://example.com/api').click();

    // 6. Click 'Add' variable
    await page.getByRole('button', { name: 'Add' }).click();

    // 7. Verify inputs appear and type in them
    const varNameInput = page.getByPlaceholder('Var Name');
    await expect(varNameInput).toBeVisible();
    await varNameInput.fill('auth_token');
    await expect(varNameInput).toHaveValue('auth_token');

    const sourceInput = page.getByPlaceholder('Source (e.g. json:id)');
    await sourceInput.fill('json:token');
    await expect(sourceInput).toHaveValue('json:token');
    
    // Note: State is local in SequenceEditor, so this verifies the "Data Entry" flow.
  });
});
