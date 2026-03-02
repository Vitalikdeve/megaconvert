import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

const sampleFile = {
  name: 'sample.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('MegaConvert smoke test file')
};

test('critical nav buttons change route', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByTestId('nav-tools').click();
  await expect(page).toHaveURL(/\/tools$/);

  await page.getByTestId('nav-guides').click();
  await expect(page).toHaveURL(/\/guides$/);

  await page.getByTestId('nav-developers').click();
  await expect(page).toHaveURL(/\/developers$/);

  await page.getByTestId('nav-status').click();
  await expect(page).toHaveURL(/\/status$/);

  await page.getByTestId('nav-security').click();
  await expect(page).toHaveURL(/\/security$/);
});

test('upload -> convert -> share buttons produce result', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/convert/pdf-to-word', { waitUntil: 'domcontentloaded' });

  await page.setInputFiles('[data-testid="file-input"]', sampleFile);
  await expect(page.getByTestId('selected-file-name')).toContainText('sample.txt');

  await page.getByTestId('convert-button').click();
  await expect(page.getByTestId('convert-button')).toHaveCount(0, { timeout: 45_000 });

  const terminalAction = page
    .locator('button')
    .filter({ hasText: /download|retry|повторить|скачать|try again/i })
    .first();
  await expect(terminalAction).toBeVisible({ timeout: 20_000 });
});

test('blog and guides read-more buttons open article pages', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  const firstBlogRead = page.locator('[data-testid^="blog-read-"]').first();
  await expect(firstBlogRead).toBeVisible();
  await firstBlogRead.click();
  await expect(page).toHaveURL(/\/blog\/.+/);
  await expect(page.locator('h1')).toBeVisible();

  await page.goto('/guides', { waitUntil: 'domcontentloaded' });
  const firstGuidesRead = page.locator('[data-testid^="guides-read-"]').first();
  await expect(firstGuidesRead).toBeVisible();
  await firstGuidesRead.click();
  await expect(page).toHaveURL(/\/guides\/.+/);
  await expect(page.locator('h1')).toBeVisible();
});

test('admin login submit button performs action (no dead click)', async ({ page }) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="password"]').fill('invalid-password-smoke');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(400);
  const onDashboard = /\/admin\/?$/.test(page.url()) && !/\/admin\/login\/?$/.test(page.url());
  if (!onDashboard) {
    const errorLocator = page
      .locator('text=/origin is not allowed|invalid|unauthorized|credentials|required|failed|error/i')
      .first();
    await expect(errorLocator).toBeVisible({ timeout: 12_000 });
  }
});
