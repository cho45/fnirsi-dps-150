import { test, expect } from './fixtures/setup';

test.describe('Protections Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Protectionsタブを表示
    await page.click('text=Protections');
    await expect(page.locator('.v-window-item--active').locator('text=Over Voltage Protection')).toBeVisible();
  });

  test('should change Over Voltage Protection (OVP)', async ({ page }) => {
    await page.locator('tr:has-text("Over Voltage Protection") td.changeable').click();
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();
    
    // 15.5V
    await page.click('#numberInputTable button:has-text("1")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.locator('#numberInputTable button').filter({ hasText: /^V$/ }).click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    expect(await page.evaluate(() => window.APP.device.overVoltageProtection)).toBe(15.5);
  });

  test('should change Over Current Protection (OCP)', async ({ page }) => {
    await page.locator('tr:has-text("Over Current Protection") td.changeable').click();
    
    // 2500mA -> 2.5A
    await page.click('#numberInputTable button:has-text("2")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.locator('#numberInputTable button').filter({ hasText: /^mA$/ }).click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    expect(await page.evaluate(() => window.APP.device.overCurrentProtection)).toBe(2.5);
  });

  test('should change Over Power Protection (OPP)', async ({ page }) => {
    await page.locator('tr:has-text("Over Power Protection") td.changeable').click();
    
    // 50W
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.locator('#numberInputTable button').filter({ hasText: /^W$/ }).click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    expect(await page.evaluate(() => window.APP.device.overPowerProtection)).toBe(50);
  });

  test('should change Over Temperature Protection (OTP)', async ({ page }) => {
    await page.locator('tr:has-text("Over Temperature Protection") td.changeable').click();
    
    // 85℃
    await page.click('#numberInputTable button:has-text("8")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.locator('#numberInputTable button').filter({ hasText: /^℃$/ }).click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    expect(await page.evaluate(() => window.APP.device.overTemperatureProtection)).toBe(85);
  });

  test('should change Low Voltage Protection (LVP)', async ({ page }) => {
    await page.locator('tr:has-text("Low Voltage Protection") td.changeable').click();
    
    // 9.0V
    await page.click('#numberInputTable button:has-text("9")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.locator('#numberInputTable button').filter({ hasText: /^V$/ }).click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
    expect(await page.evaluate(() => window.APP.device.lowVoltageProtection)).toBe(9.0);
  });
});
