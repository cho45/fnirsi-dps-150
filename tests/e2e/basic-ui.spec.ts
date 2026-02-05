import { test, expect } from './fixtures/setup';

test.describe('Basic UI Elements', () => {
  test('should display connect button when disconnected', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // Connectボタンが表示される
    await expect(page.locator('.connect')).toBeVisible();

    // デバイス情報は表示されない（未接続状態）
    // メインビューにはハイフンが表示される
    await expect(page.locator('.main-view')).toContainText('-');
  });

  test('should display app bar elements', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // アプリケーションバーが表示される
    await expect(page.locator('.v-app-bar')).toBeVisible();

    // Connectボタンが表示される
    await expect(page.locator('.connect')).toBeVisible();
  });

  test('should display main view with voltage/current/power', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // メインビューが表示される
    await expect(page.locator('.main-view')).toBeVisible();

    // 電圧/電流/電力のセクションが表示される
    await expect(page.locator('.changeable.voltage')).toBeVisible();
    await expect(page.locator('.changeable.current')).toBeVisible();
    await expect(page.locator('.power')).toBeVisible();
  });

  test('should display all tabs and their contents', async ({ page }) => {
    await page.goto('/?test=true');

    // Memory Groups (タブをクリックして確実に活性化させる)
    await page.click('text=Memory Groups');
    await expect(page.locator('.v-window-item--active .groups')).toBeVisible();

    // Metering
    await page.click('text=Metering');
    await expect(page.locator('.v-window-item--active button:has-text("Start"), .v-window-item--active button:has-text("Stop")')).toBeVisible();

    // Protections
    await page.click('text=Protections');
    await expect(page.locator('text=Over Voltage Protection')).toBeVisible();

    // Program
    await page.click('text=Program');
    await expect(page.locator('.v-window-item--active textarea').first()).toBeVisible();

    // History
    await page.click('text=History');
    await expect(page.locator('.v-window-item--active').locator('text=Time')).toBeVisible();

    // Settings
    await page.click('text=Settings');
    await expect(page.locator('.v-window-item--active').locator('text=Brightness')).toBeVisible();
  });
});
