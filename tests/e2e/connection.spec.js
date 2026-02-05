import { test, expect } from './fixtures/setup';

test.describe('Device Connection', () => {
  test('should display connect button when disconnected', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // Connectボタンが表示される
    await expect(page.locator('.connect')).toBeVisible();
  });

  test('should have mock loaded', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // モックが読み込まれていることを確認
    const mockExists = await page.evaluate(() => {
      return typeof window.__MOCK_BACKEND__ !== 'undefined';
    });

    console.log('Mock exists:', mockExists);
    expect(mockExists).toBe(true);
  });

  test('should display device info after connection', async ({ page }) => {
    await page.goto('/?test=true');

    // オーバーレイが消えていることを確認（自動接続済み）
    await expect(page.locator('.v-overlay--active')).toHaveCount(0);
  });
});
