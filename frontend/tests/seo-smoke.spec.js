import { test, expect } from '@playwright/test';

const SEO_CASES = [
  { path: '/convert/pdf-to-word', canonicalEndsWith: '/convert/pdf-to-word' },
  { path: '/convert/png-to-jpg', canonicalEndsWith: '/convert/png-to-jpg' },
  { path: '/convert/mp4-to-mp3', canonicalEndsWith: '/convert/mp4-to-mp3' },
  { path: '/pdf-to-word', canonicalEndsWith: '/convert/pdf-to-word' },
  { path: '/png-to-jpg', canonicalEndsWith: '/convert/png-to-jpg' },
  { path: '/mp4-to-mp3', canonicalEndsWith: '/convert/mp4-to-mp3' },
  { path: '/guides', canonicalEndsWith: '/guides' },
  { path: '/security', canonicalEndsWith: '/security' },
  { path: '/privacy', canonicalEndsWith: '/privacy' },
  { path: '/about', canonicalEndsWith: '/about' }
];

for (const item of SEO_CASES) {
  test(`seo tags are present for ${item.path}`, async ({ page }) => {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/MegaConvert/i);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.+/);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /index,follow/i);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', new RegExp(`${item.canonicalEndsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

    const altEn = page.locator('link[rel="alternate"][hreflang="en"]');
    const altEs = page.locator('link[rel="alternate"][hreflang="es"]');
    const altDe = page.locator('link[rel="alternate"][hreflang="de"]');
    await expect(altEn).toHaveCount(1);
    await expect(altEs).toHaveCount(1);
    await expect(altDe).toHaveCount(1);

    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const jsonText = await jsonLd.first().textContent();
    expect(jsonText || '').toContain('SoftwareApplication');

    const ctaButton = page.getByRole('button', { name: /upload|convert now|browse available converters|tools|security|status/i }).first();
    const ctaLink = page.getByRole('link', { name: /upload|try converter|open converter|browse tools|privacy|terms|about/i }).first();
    const buttonCount = await ctaButton.count();
    const linkCount = await ctaLink.count();
    if (buttonCount > 0) {
      await expect(ctaButton).toBeVisible();
    } else if (linkCount > 0) {
      await expect(ctaLink).toBeVisible();
    } else {
      const anyInteractive = page.locator('main button, main a, button, a').first();
      await expect(anyInteractive).toBeVisible();
    }
  });
}
