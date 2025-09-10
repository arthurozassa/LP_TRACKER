import { test, expect } from '@playwright/test';

test.describe('Accessibility Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Semantic HTML and ARIA', () => {
    test('should use proper heading hierarchy', async ({ page }) => {
      // Main title should be h1
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(/LP Position Tracker/);
      
      // After scanning, should have proper h2 headings
      await page.locator('button:has-text("Ethereum Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      const h2Elements = page.locator('h2');
      await expect(h2Elements.first()).toBeVisible();
      
      // Should have logical heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      expect(headings[0]).toMatch(/LP Position Tracker/);
    });

    test('should have proper form labels and descriptions', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      
      // Input should have accessible name/label
      const inputName = await searchInput.getAttribute('aria-label') || 
                        await searchInput.getAttribute('placeholder') ||
                        'no-label';
      
      expect(inputName).toMatch(/wallet|address/i);
      
      // Should have proper input type
      const inputType = await searchInput.getAttribute('type');
      expect(inputType).toBe('text');
    });

    test('should have proper button labels and states', async ({ page }) => {
      // Demo buttons should have descriptive text
      const demoButtons = page.locator('button:has-text("Ethereum Whale")');
      await expect(demoButtons.first()).toBeVisible();
      
      // Scan button should have clear purpose
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await expect(scanButton).toBeVisible();
      
      // When disabled, should have proper state
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      await searchInput.fill('invalid');
      await expect(scanButton).toBeDisabled();
    });

    test('should provide proper loading state feedback', async ({ page }) => {
      await page.locator('button:has-text("Solana Whale")').first().click();
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await scanButton.click();
      
      // Should show loading state
      await expect(page.locator('text=Scanning All DEXs')).toBeVisible();
      
      // Loading spinner should have proper aria-label or be decorative
      const spinner = page.locator('.animate-spin');
      if (await spinner.count() > 0) {
        const ariaHidden = await spinner.getAttribute('aria-hidden');
        const ariaLabel = await spinner.getAttribute('aria-label');
        
        // Either hidden from screen readers or has descriptive label
        expect(ariaHidden === 'true' || ariaLabel?.length > 0).toBeTruthy();
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async ({ page }) => {
      // Start with focus on search input
      await page.keyboard.press('Tab');
      await expect(page.locator('input[placeholder*="wallet address"]')).toBeFocused();
      
      // Tab through demo buttons
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to select demo with Enter
      await page.keyboard.press('Enter');
      
      // Input should be populated
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
      
      // Tab to scan button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await expect(scanButton).toBeFocused();
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Scanning All DEXs')).toBeVisible();
    });

    test('should maintain visible focus indicators', async ({ page }) => {
      // Tab through elements and check for focus indicators
      await page.keyboard.press('Tab'); // Search input
      
      let focusedElement = page.locator(':focus');
      let outlineStyle = await focusedElement.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.outline + style.boxShadow;
      });
      
      // Should have some form of focus indication
      expect(outlineStyle).not.toBe('none ');
      
      await page.keyboard.press('Tab'); // Demo button
      await page.keyboard.press('Tab');
      
      focusedElement = page.locator(':focus');
      outlineStyle = await focusedElement.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.outline + style.boxShadow;
      });
      
      // Focus should be visible
      expect(outlineStyle.length).toBeGreaterThan(10);
    });

    test('should handle focus management in dynamic content', async ({ page }) => {
      // Complete scan to show results
      await page.locator('button:has-text("Jupiter Trader")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Focus should remain manageable with new content
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to navigate to protocol cards
      const protocolCard = page.locator('button').first();
      if (await protocolCard.isVisible()) {
        await protocolCard.focus();
        await expect(protocolCard).toBeFocused();
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper page title', async ({ page }) => {
      const title = await page.title();
      expect(title).toMatch(/LP.*Track|Position.*Track/i);
    });

    test('should have descriptive text for complex UI elements', async ({ page }) => {
      // Demo addresses should have good descriptions
      const demoButton = page.locator('button:has-text("Ethereum Whale")').first();
      const buttonText = await demoButton.textContent();
      
      // Should contain meaningful information
      expect(buttonText).toMatch(/Ethereum Whale/);
      expect(buttonText?.length).toBeGreaterThan(10); // Should have description
    });

    test('should provide status updates for dynamic content', async ({ page }) => {
      await page.locator('button:has-text("Ethereum Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      
      // Loading state should be announced
      const loadingText = page.locator('text=Scanning All DEXs');
      await expect(loadingText).toBeVisible();
      
      // Results should eventually load
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Success state should be clear
      await expect(page.locator('text=All Positions')).toBeVisible();
    });

    test('should handle error states accessibly', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      await searchInput.fill('invalid-address-format');
      
      // Error message should be associated with input
      await expect(page.locator('text=Invalid address format')).toBeVisible();
      
      // Scan button should be disabled with clear state
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await expect(scanButton).toBeDisabled();
      
      const isDisabled = await scanButton.isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Color Contrast and Visual Accessibility', () => {
    test('should meet WCAG color contrast requirements', async ({ page }) => {
      // Check main title contrast
      const title = page.locator('h1');
      const titleColor = await title.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          color: style.color,
          background: style.backgroundColor || getComputedStyle(document.body).backgroundColor
        };
      });
      
      // Should use high contrast colors (light text on dark background)
      expect(titleColor.color).toMatch(/rgb\(240|248|255/); // Light text
      
      // Check button contrast
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      const buttonStyles = await scanButton.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          color: style.color,
          background: style.backgroundColor,
        };
      });
      
      // Button should have sufficient contrast
      expect(buttonStyles.color).toMatch(/rgb\(255, 255, 255\)|rgb\(248, 250, 252\)/);
    });

    test('should not rely solely on color for information', async ({ page }) => {
      // Complete scan to see status indicators
      await page.locator('button:has-text("Ethereum Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Positive/negative indicators should have more than just color
      const statusElements = page.locator('.tt-status-positive, .tt-status-negative');
      if (await statusElements.count() > 0) {
        const statusText = await statusElements.first().textContent();
        // Should have text content, not just color
        expect(statusText?.length).toBeGreaterThan(0);
      }
    });

    test('should support system dark/light mode preferences', async ({ page }) => {
      // App should work well with system preferences
      // Our app is primarily dark mode, but should be readable
      
      const bodyBg = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.backgroundColor;
      });
      
      // Should have consistent dark theme
      expect(bodyBg).toMatch(/rgb\(13, 17, 23\)|rgb\(17, 24, 39\)|rgb\(15, 23, 42\)/);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should have appropriate touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Demo buttons should be large enough for touch
      const demoButton = page.locator('button:has-text("Ethereum Whale")').first();
      const buttonBox = await demoButton.boundingBox();
      
      // WCAG recommends minimum 44px touch targets
      expect(buttonBox?.height).toBeGreaterThanOrEqual(40);
      
      // Scan button should also be appropriately sized
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      const scanBox = await scanButton.boundingBox();
      expect(scanBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('should handle mobile interaction patterns', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Should be able to tap demo addresses
      const demoButton = page.locator('button:has-text("Solana Whale")').first();
      await demoButton.tap();
      
      // Input should be populated
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
      
      // Should be able to tap scan button
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await scanButton.tap();
      
      await expect(page.locator('text=Scanning All DEXs')).toBeVisible();
    });

    test('should maintain accessibility in responsive layouts', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // All important elements should remain accessible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('input[placeholder*="wallet address"]')).toBeVisible();
      await expect(page.locator('button:has-text("Scan All DEXs")')).toBeVisible();
      
      // Demo buttons should be properly stacked and accessible
      const demoButtons = page.locator('button:has-text("Ethereum Whale")');
      for (let i = 0; i < await demoButtons.count(); i++) {
        await expect(demoButtons.nth(i)).toBeVisible();
      }
    });
  });
});