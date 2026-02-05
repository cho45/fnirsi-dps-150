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

  test('should display all tabs', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // タブが表示される
    await expect(page.locator('text=Memory Groups')).toBeVisible();
    await expect(page.locator('text=Metering')).toBeVisible();
    await expect(page.locator('text=Protections')).toBeVisible();
    await expect(page.locator('text=Program')).toBeVisible();
    await expect(page.locator('text=History')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });
});
