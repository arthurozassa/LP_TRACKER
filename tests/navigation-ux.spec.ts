import { test, expect } from '@playwright/test';

test.describe('Navigation and UX Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Screen Space Utilization', () => {
    test('should utilize screen space effectively on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Check if header takes appropriate space
      const header = page.locator('h1');
      await expect(header).toBeVisible();
      
      const headerBox = await header.boundingBox();
      expect(headerBox?.height).toBeLessThan(200); // Header shouldn't be too tall
      
      // Check if main content area uses available space
      const mainContent = page.locator('main');
      const mainBox = await mainContent.boundingBox();
      
      // Content should use most of the screen height
      expect(mainBox?.height).toBeGreaterThan(800);
      
      // Check container width utilization
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      // Should use reasonable width with padding
      expect(containerBox?.width).toBeGreaterThan(1200);
      expect(containerBox?.width).toBeLessThan(1600);
    });

    test('should adapt well to mobile screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      // Content should be visible and not overflow
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      expect(containerBox?.width).toBeLessThan(375);
      
      // Check if search bar is properly sized
      const searchBar = page.locator('input[placeholder*="wallet address"]');
      await expect(searchBar).toBeVisible();
      
      const searchBox = await searchBar.boundingBox();
      expect(searchBox?.width).toBeLessThan(350);
    });

    test('should handle ultra-wide screens properly', async ({ page }) => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      
      // Content should be centered and not stretch too wide
      const container = page.locator('.tt-container');
      const containerBox = await container.boundingBox();
      
      // Should have max-width constraint
      expect(containerBox?.width).toBeLessThan(1400);
      
      // Should be centered
      const windowWidth = await page.evaluate(() => window.innerWidth);
      const leftMargin = containerBox?.x || 0;
      const rightMargin = windowWidth - (containerBox?.x || 0) - (containerBox?.width || 0);
      
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(50); // Approximately centered
    });
  });

  test.describe('Navigation Flow', () => {
    test('should have clear navigation path from landing to results', async ({ page }) => {
      // Landing state - check welcome message
      await expect(page.locator('text=Ready to Track Your LP Positions')).toBeVisible();
      
      // Check demo addresses are visible and clickable
      const demoButtons = page.locator('button:has-text("Ethereum Whale")');
      await expect(demoButtons).toBeVisible();
      
      // Click demo address
      await demoButtons.first().click();
      
      // Input should be populated
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toContain('0x742d35Cc');
      
      // Scan button should be enabled
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await expect(scanButton).toBeEnabled();
      
      // Click scan button
      await scanButton.click();
      
      // Should show loading state
      await expect(page.locator('text=Scanning All DEXs')).toBeVisible();
      
      // Wait for results (with timeout for mock data)
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
    });

    test('should provide clear error feedback for invalid addresses', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      
      // Type invalid address
      await searchInput.fill('invalid-address');
      
      // Should show validation error
      await expect(page.locator('text=Invalid address format')).toBeVisible();
      
      // Scan button should be disabled
      const scanButton = page.locator('button:has-text("Scan All DEXs")');
      await expect(scanButton).toBeDisabled();
    });
  });

  test.describe('Interactive Elements', () => {
    test('should have proper hover states and click feedback', async ({ page }) => {
      // Demo address buttons should have hover effects
      const demoButton = page.locator('button:has-text("Ethereum Whale")').first();
      await expect(demoButton).toBeVisible();
      
      // Test hover state
      await demoButton.hover();
      await page.waitForTimeout(500); // Allow transition
      
      // Click and verify interaction
      await demoButton.click();
      
      // Input should be populated indicating successful click
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Focus should start on the search input
      await page.keyboard.press('Tab');
      await expect(page.locator('input[placeholder*="wallet address"]')).toBeFocused();
      
      // Tab to demo buttons
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to activate with Enter/Space
      await page.keyboard.press('Enter');
      
      // Input should be populated
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
    });
  });

  test.describe('Advanced Analytics Integration', () => {
    test('should load and display analytics after scanning', async ({ page }) => {
      // Start scan process
      await page.locator('button:has-text("Ethereum Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      
      // Wait for results
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Check if advanced analytics toggle appears
      const analyticsToggle = page.locator('button:has-text("Show Advanced Analytics")');
      await expect(analyticsToggle).toBeVisible();
      
      // Click to show analytics
      await analyticsToggle.click();
      
      // Verify analytics components load
      await expect(page.locator('text=Portfolio Performance')).toBeVisible();
      await expect(page.locator('text=HODL Comparison')).toBeVisible(); 
      await expect(page.locator('text=Risk Metrics')).toBeVisible();
      await expect(page.locator('text=Yield Optimizer')).toBeVisible();
      await expect(page.locator('text=Smart Alerts')).toBeVisible();
    });

    test('should handle analytics toggle properly', async ({ page }) => {
      // Complete scan first
      await page.locator('button:has-text("Solana Whale")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      const analyticsToggle = page.locator('button:has-text("Show Advanced Analytics")');
      await analyticsToggle.click();
      
      // Analytics should be visible
      await expect(page.locator('text=Portfolio Performance')).toBeVisible();
      
      // Toggle to hide
      const hideToggle = page.locator('button:has-text("Hide Advanced Analytics")');
      await hideToggle.click();
      
      // Analytics should be hidden
      await expect(page.locator('text=Portfolio Performance')).not.toBeVisible();
    });
  });

  test.describe('Content Layout and Spacing', () => {
    test('should have consistent spacing between elements', async ({ page }) => {
      const header = page.locator('h1');
      const searchSection = page.locator('.tt-card').first();
      
      const headerBox = await header.boundingBox();
      const searchBox = await searchSection.boundingBox();
      
      // Should have reasonable spacing between header and search
      const spacing = (searchBox?.y || 0) - ((headerBox?.y || 0) + (headerBox?.height || 0));
      expect(spacing).toBeGreaterThan(32); // At least 2rem spacing
      expect(spacing).toBeLessThan(128); // Not too much spacing
    });

    test('should maintain readability at different screen sizes', async ({ page }) => {
      // Test different viewport sizes
      const viewports = [
        { width: 375, height: 667 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1280, height: 720 },  // Small desktop
        { width: 1920, height: 1080 }, // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        // Title should be visible and appropriately sized
        const title = page.locator('h1');
        await expect(title).toBeVisible();
        
        const titleBox = await title.boundingBox();
        
        // Title shouldn't be too large or small relative to viewport
        const titleRatio = (titleBox?.height || 0) / viewport.height;
        expect(titleRatio).toBeGreaterThan(0.03); // At least 3% of screen
        expect(titleRatio).toBeLessThan(0.15);     // No more than 15% of screen
      }
    });
  });

  test.describe('Performance and Loading States', () => {
    test('should show appropriate loading indicators', async ({ page }) => {
      await page.locator('button:has-text("Jupiter Trader")').first().click();
      await page.locator('button:has-text("Scan All DEXs")').click();
      
      // Should show loading state immediately
      await expect(page.locator('text=Scanning All DEXs')).toBeVisible();
      
      // Button should show spinner
      const loadingSpinner = page.locator('.animate-spin');
      await expect(loadingSpinner).toBeVisible();
      
      // Should eventually complete
      await expect(page.locator('text=Protocol Distribution')).toBeVisible({ timeout: 10000 });
      
      // Loading state should disappear
      await expect(page.locator('text=Scanning All DEXs')).not.toBeVisible();
    });

    test('should handle no results gracefully', async ({ page }) => {
      // Enter a valid but empty address format
      const searchInput = page.locator('input[placeholder*="wallet address"]');
      await searchInput.fill('0x0000000000000000000000000000000000000000');
      
      await page.locator('button:has-text("Scan All DEXs")').click();
      await page.waitForTimeout(3000); // Wait for scan to complete
      
      // Should show empty state message
      await expect(page.locator('text=No liquidity positions found')).toBeVisible();
    });
  });
});