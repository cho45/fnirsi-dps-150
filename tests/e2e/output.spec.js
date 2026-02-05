import { test, expect } from './fixtures/setup';

test.describe('Output Control', () => {
  test('should toggle output via UI button', async ({ page }) => {
    await page.goto('/?test=true');

    // 初期状態: outputClosed=false (OFF) なので "Enable" ボタンが表示されている
    const enableBtn = page.locator('button[title="Enable"]');
    await expect(enableBtn).toBeVisible();

    // 内部状態を確認 (OFF)
    expect(await page.evaluate(() => window.APP.device.outputClosed)).toBe(false);

    // ボタンをクリックして出力をONにする
    await enableBtn.click();
    await page.waitForTimeout(100);

    // ボタンの表示が "Disable" に変わる (ON状態)
    const disableBtn = page.locator('button[title="Disable"]');
    await expect(disableBtn).toBeVisible();

    // 内部状態を確認 (ON)
    expect(await page.evaluate(() => window.APP.device.outputClosed)).toBe(true);

    // 再度クリックしてOFFに戻す
    await disableBtn.click();
    await page.waitForTimeout(100);
    await expect(page.locator('button[title="Enable"]')).toBeVisible();
    expect(await page.evaluate(() => window.APP.device.outputClosed)).toBe(false);
  });
});
