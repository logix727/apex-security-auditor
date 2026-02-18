import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Apex/);
});

test('workbench loads', async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
  await page.goto('/');
  
  // Wait for header to ensure app loaded
  await expect(page.locator('.header')).toBeVisible();

  // Check for error boundary first
  const errorBoundary = page.getByText('Something went wrong');
  if (await errorBoundary.isVisible()) {
    const errorText = await page.locator('pre').textContent();
    console.error('App crashed:', errorText);
    require('fs').writeFileSync('e2e-error.log', `App crashed: ${errorText}`);
    throw new Error(`App crashed: ${errorText}`);
  }

  // Check if sidebar exists
  await expect(page.locator('.sidebar')).toBeVisible();
  // Check for Dashboard text
  await expect(page.getByText('Dashboard', { exact: true })).toBeVisible();
  // Check for Workbench text (not exact due to counter badge)
  await expect(page.locator('.nav-item').getByText('Workbench', { exact: false })).toBeVisible();
});
