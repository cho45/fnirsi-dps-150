import { test, expect } from './fixtures/setup';

test.describe('Output Control', () => {
  test('should show Disable button in initial state', async ({ page }) => {
    await page.goto('/?test=true');

    // 初期状態は outputClosed=true なので Disable ボタンが表示される
    await expect(page.locator('button[title="Disable"]')).toBeVisible();
  });

  test('should show Enable button when output is enabled', async ({ page }) => {
    await page.goto('/?test=true');

    // 初期状態は Disable ボタンが表示される
    await expect(page.locator('button[title="Disable"]')).toBeVisible();

    // enable() を直接呼び出して出力を有効化
    await page.evaluate(async () => {
      await window.APP.dps.enable();
    });
    await page.waitForTimeout(100);

    // Enable ボタンが表示される
    await expect(page.locator('button[title="Enable"]')).toBeVisible();

    // Enable ボタンをクリックしても何も変わらない（すでに有効状態）
    await page.locator('button[title="Enable"]').click();
    await page.waitForTimeout(100);

    // まだ Enable ボタンが表示される
    await expect(page.locator('button[title="Enable"]')).toBeVisible();
  });

  test('should show Disable button when output is disabled', async ({ page }) => {
    await page.goto('/?test=true');

    // enable() を呼び出して出力を有効化
    await page.evaluate(async () => {
      await window.APP.dps.enable();
    });
    await page.waitForTimeout(100);

    // Enable ボタンが表示される
    await expect(page.locator('button[title="Enable"]')).toBeVisible();

    // disable() を呼び出して出力を無効化
    await page.evaluate(async () => {
      await window.APP.dps.disable();
    });
    await page.waitForTimeout(100);

    // Disable ボタンが表示される
    await expect(page.locator('button[title="Disable"]')).toBeVisible();
  });
});
