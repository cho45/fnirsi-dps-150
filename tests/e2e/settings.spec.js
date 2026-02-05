import { test, expect } from './fixtures/setup';

test.describe('Settings Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Settingsタブを表示
    await page.click('text=Settings');
    await expect(page.locator('.v-window-item--active').locator('text=Brightness')).toBeVisible();
  });

  test('should change brightness', async ({ page }) => {
    // Brightnessの設定値が表示されている td 要素をクリック
    await page.locator('tr:has-text("Brightness") td.changeable').click();
    
    // ダイアログが表示されるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();
    
    // 8 を入力
    await page.click('#numberInputTable button:has-text("8")');
    // x1 ボタンで確定
    await page.locator('#numberInputTable button').filter({ hasText: /^x1$/ }).click();
    
    // ダイアログが閉じるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    
    // 内部状態が更新されていることを確認
    const newBrightness = await page.evaluate(() => window.APP.device.brightness);
    expect(newBrightness).toBe(8);
  });

  test('should change volume', async ({ page }) => {
    // Volumeの設定値が表示されている td 要素をクリック
    await page.locator('tr:has-text("Volume") td.changeable').click();
    
    // ダイアログが表示されるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();
    
    // 5 を入力
    await page.click('#numberInputTable button:has-text("5")');
    // x1 ボタンで確定
    await page.locator('#numberInputTable button').filter({ hasText: /^x1$/ }).click();
    
    // ダイアログが閉じるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    
    // 内部状態が更新されていることを確認
    const newVolume = await page.evaluate(() => window.APP.device.volume);
    expect(newVolume).toBe(5);
  });
});
