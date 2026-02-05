import { test, expect } from './fixtures/setup';

test.describe('Metering Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Meteringタブを表示
    await page.click('text=Metering');
    await expect(page.locator('.v-window-item--active').locator('text=Output Capacity')).toBeVisible();
  });

  test('should display capacity in mAh when < 1Ah', async ({ page }) => {
    // 0.123 Ah を注入
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputCapacity: 0.123456 });
    });

    // 123.46mAh と表示されることを確認 (1000倍した値が10以上なので小数点2桁)
    const capacityCell = page.locator('tr:has-text("Output Capacity") td').nth(1);
    await expect(capacityCell).toContainText('123.46mAh');
  });

  test('should display capacity in Ah when >= 1Ah', async ({ page }) => {
    // 1.234 Ah を注入
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputCapacity: 1.234567 });
    });

    const capacityCell = page.locator('tr:has-text("Output Capacity") td').nth(1);
    await expect(capacityCell).toContainText('1.235Ah'); // 1.234567 -> 1.235 (10未満なので3桁)
  });

  test('should display energy in mWh when < 1Wh', async ({ page }) => {
    // 0.5 Wh を注入
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputEnergy: 0.5 });
    });

    const energyCell = page.locator('tr:has-text("Output Energy") td').nth(1);
    await expect(energyCell).toContainText('500.00mWh'); // 500 -> 500.00 (10以上なので2桁)
  });

  test('should display energy in Wh when >= 1Wh', async ({ page }) => {
    // 12.5 Wh を注入
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputEnergy: 12.5 });
    });

    const energyCell = page.locator('tr:has-text("Output Energy") td').nth(1);
    await expect(energyCell).toContainText('12.50Wh'); // 10V以上の場合は %05.2f になる仕様
  });
});
