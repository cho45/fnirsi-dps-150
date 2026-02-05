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

  test('should connect manually and display device info', async ({ page }) => {
    await page.goto('/?test=true&noconnect');

    // オーバーレイが表示されている
    await expect(page.locator('.v-overlay--active')).toBeVisible();

    // Connectボタンをクリック
    await page.click('.v-overlay__content button:has-text("Connect")');

    // オーバーレイが消えるのを待つ
    await expect(page.locator('.v-overlay--active')).toHaveCount(0);

    // アプリバーにデバイス情報が表示される
    const appBarTitle = page.locator('.v-app-bar-title');
    await expect(appBarTitle).toContainText('DPS-150');
    await expect(appBarTitle).toContainText('v2.1');
    await expect(appBarTitle).toContainText('v1.0');
  });

  test('should disconnect manually', async ({ page }) => {
    await page.goto('/?test=true');

    // 初期状態は自動接続済み (オーバーレイなし)
    await expect(page.locator('.v-overlay--active')).toHaveCount(0);

    // 切断ボタンをクリック (アプリバー内の緑色のボタン)
    await page.click('.disconnect');

    // 再びオーバーレイが表示される
    const overlay = page.locator('.v-overlay__content').filter({ hasText: 'Device is not connected' });
    await expect(overlay).toBeVisible();
  });
});
