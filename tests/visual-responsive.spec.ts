import { test, expect } from '@playwright/test';

test.describe('Visual Design and Responsive Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Visual Design Token Terminal Aesthetic', () => {
    test('should use proper Token Terminal color scheme', async ({ page }) => {
      // Check background color is dark
      const body = page.locator('body');
      const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
      
      // Should be a dark background (not the bright crypto colors)
      expect(bgColor).toMatch(/rgb\(15, 23, 42\)|rgb\(13, 17, 23\)|rgb\(17, 24, 39\)/); // Dark grays
      
      // Check cards use subtle styling
      const card = page.locator('.tt-card').first();
      await expect(card).toBeVisible();
      
      const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
      // Should be subtle, not bright orange/cyan
      expect(cardBg).not.toMatch(/rgb\(245, 75, 0\)|rgb\(0, 212, 255\)/);
    });

    test('should use Inter font family', async ({ page }) => {
      const title = page.locator('h1');
      const fontFamily = await title.evaluate((el) => getComputedStyle(el).fontFamily);
      
      // Should include Inter font
      expect(fontFamily.toLowerCase()).toMatch(/inter/);
    });

    test('should have clean minimal borders and shadows', async ({ page }) => {
      const cards = page.locator('.tt-card');
      await expect(cards.first()).toBeVisible();
      
      // Check for subtle borders instead of bright colored ones
      const borderColor = await cards.first().evaluate((el) => getComputedStyle(el).borderColor);
      
      // Should not be bright orange borders
      expect(borderColor).not.toMatch(/rgb\(245, 75, 0\)/);
    });
  });

  test.describe('Responsive Layout Testing', () => {
    const devices = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'iPad', width: 768, height: 1024 },
      { name: 'Desktop Small', width: 1280, height: 720 },
      { name: 'Desktop Large', width: 1920, height: 1080 },
      { name: 'Ultra Wide', width: 2560, height: 1440 },
    ];

    for (const device of devices) {
      test(`should be fully responsive on ${device.name} (${device.width}x${device.height})`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        
        // All key elements should be visible
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('input[placeholder*="wallet address"]')).toBeVisible();
        await expect(page.locator('button:has-text("Scan All DEXs")')).toBeVisible();
        
        // Demo addresses should be visible (might be stacked on mobile)
        await expect(page.locator('button:has-text("Ethereum Whale")')).toBeVisible();
        
        // No horizontal scrollbar should appear
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(device.width + 1); // +1 for rounding
        
        // Content should fit in viewport
        const container = page.locator('.tt-container');
        const containerBox = await container.boundingBox();
        expect(containerBox?.width).toBeLessThanOrEqual(device.width);
      });
    }

    test('should stack demo addresses properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const demoContainer = page.locator('text=Try Demo Addresses').locator('..').locator('div').last();
      const demoButtons = demoContainer.locator('button');
      
      // Get positions of first two buttons
      const firstButton = demoButtons.nth(0);
      const secondButton = demoButtons.nth(1);
      
      const firstBox = await firstButton.boundingBox();
      const secondBox = await secondButton.boundingBox();
      
      // On mobile, buttons should stack vertically (second button below first)
      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
      }
    });

    test('should arrange demo addresses in grid on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      
      const demoContainer = page.locator('text=Try Demo Addresses').locator('..').locator('div').last();
      const demoButtons = demoContainer.locator('button');
      
      // Get positions of first two buttons
      const firstButton = demoButtons.nth(0);
      const secondButton = demoButtons.nth(1);
      
      const firstBox = await firstButton.boundingBox();
      const secondBox = await secondButton.boundingBox();
      
      // On desktop, buttons should be side by side (approximately same y position)
      if (firstBox && secondBox) {
        expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThan(20);
        expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width - 20);
      }
    });
  });

  test.describe('Screen Real Estate Utilization', () => {
    test('should use appropriate margins and padding on large screens', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      // Should be centered with reasonable max-width
      expect(containerBox?.width).toBeGreaterThan(1200);
      expect(containerBox?.width).toBeLessThan(1400);
      
      // Should be properly centered
      const windowWidth = 1920;
      const leftMargin = containerBox?.x || 0;
      const rightMargin = windowWidth - leftMargin - (containerBox?.width || 0);
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(50);
    });

    test('should maximize content area on mobile without cramping', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      // Should use most of the width but with some padding
      expect(containerBox?.width).toBeGreaterThan(300);
      expect(containerBox?.width).toBeLessThan(375);
      
      // Should have reasonable padding
      const leftPadding = containerBox?.x || 0;
      expect(leftPadding).toBeGreaterThan(8); // At least some padding
      expect(leftPadding).toBeLessThan(40); // Not too much padding
    });

    test('should maintain good proportions in results view', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Trigger demo scan
      await page.locator('button:has-text("Ethereum Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Protocol cards should use appropriate grid
      const protocolSection = page.locator('text=Protocol Distribution').locator('..');
      const protocolCards = protocolSection.locator('button').first();
      
      await expect(protocolCards).toBeVisible();
      const cardBox = await protocolCards.boundingBox();
      
      // Cards shouldn't be too wide or too narrow
      expect(cardBox?.width).toBeGreaterThan(200);
      expect(cardBox?.width).toBeLessThan(400);
    });
  });

  test.describe('Advanced Analytics Layout', () => {
    test('should properly layout analytics components', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Complete scan and show analytics
      await page.locator('button:has-text("Solana Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      await page.locator('button:has-text("Show Advanced Analytics")').click();
      
      // Performance chart should be full width
      const performanceChart = page.locator('text=Portfolio Performance').locator('..');
      const chartBox = await performanceChart.boundingBox();
      
      // Should use most of the container width
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      if (chartBox && containerBox) {
        const widthRatio = chartBox.width / containerBox.width;
        expect(widthRatio).toBeGreaterThan(0.8); // At least 80% of container
      }
      
      // Grid components should be properly arranged
      const riskMetrics = page.locator('text=Risk Metrics').locator('..');
      const hodlComparison = page.locator('text=HODL vs LP Strategy').locator('..');
      
      const riskBox = await riskMetrics.boundingBox();
      const hodlBox = await hodlComparison.boundingBox();
      
      if (riskBox && hodlBox) {
        // Should be approximately side by side
        expect(Math.abs(riskBox.y - hodlBox.y)).toBeLessThan(50);
        // Should be roughly equal width
        expect(Math.abs(riskBox.width - hodlBox.width)).toBeLessThan(100);
      }
    });

    test('should stack analytics components properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Complete scan and show analytics
      await page.locator('button:has-text("Jupiter Trader")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      await page.locator('button:has-text("Show Advanced Analytics")').click();
      
      // Components should stack vertically on mobile
      const riskMetrics = page.locator('text=Risk Metrics').locator('..');
      const hodlComparison = page.locator('text=HODL vs LP Strategy').locator('..');
      
      const riskBox = await riskMetrics.boundingBox();
      const hodlBox = await hodlComparison.boundingBox();
      
      if (riskBox && hodlBox) {
        // Should be stacked vertically (significant Y difference)
        expect(Math.abs(riskBox.y - hodlBox.y)).toBeGreaterThan(100);
      }
    });
  });

  test.describe('Typography and Readability', () => {
    test('should have appropriate font sizes across devices', async ({ page }) => {
      const devices = [
        { width: 375, height: 667, minTitleSize: 24, maxTitleSize: 36 },
        { width: 768, height: 1024, minTitleSize: 30, maxTitleSize: 48 },
        { width: 1920, height: 1080, minTitleSize: 36, maxTitleSize: 64 },
      ];

      for (const device of devices) {
        await page.setViewportSize({ width: device.width, height: device.height });
        
        const title = page.locator('h1');
        const fontSize = await title.evaluate((el) => {
          const style = getComputedStyle(el);
          return parseInt(style.fontSize);
        });
        
        expect(fontSize).toBeGreaterThanOrEqual(device.minTitleSize);
        expect(fontSize).toBeLessThanOrEqual(device.maxTitleSize);
      }
    });

    test('should maintain good contrast ratios', async ({ page }) => {
      // Primary text should have good contrast
      const title = page.locator('h1');
      const titleColor = await title.evaluate((el) => getComputedStyle(el).color);
      
      // Should be light text on dark background
      expect(titleColor).toMatch(/rgb\(240, 246, 252\)|rgb\(248, 250, 252\)|rgb\(255, 255, 255\)/);
      
      // Secondary text should be readable but subdued
      const description = page.locator('p').first();
      const descColor = await description.evaluate((el) => getComputedStyle(el).color);
      
      // Should not be the same as primary (should be more muted)
      expect(descColor).not.toBe(titleColor);
    });
  });
});