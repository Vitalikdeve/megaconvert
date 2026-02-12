import { test, expect } from '@playwright/test';

const fixture = 'tests/fixtures/sample.txt';

test('format card sets tool and allows file selection', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('format-card-mp4-mp3').click();
  await expect(page.getByTestId('active-tool')).toHaveText('mp4-mp3');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('selected-file-name')).toContainText('sample.txt');
});

test('convert flow completes with mocked API', async ({ page }) => {
  await page.route('**/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-1' })
    });
  });
  await page.route('**/jobs/job-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'completed', progress: 100, downloadUrl: 'http://localhost:3000/files/test' })
    });
  });

  await page.goto('/');
  await page.getByTestId('cta-upload').click();
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByTestId('convert-button').click();
  await expect(page.getByText('Done!')).toBeVisible();
});
