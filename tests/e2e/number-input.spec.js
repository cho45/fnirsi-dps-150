import { test, expect } from './fixtures/setup';

test.describe('Number Input Dialog', () => {
  test('should open dialog when clicking voltage', async ({ page }) => {
    await page.goto('/?test=true');

    // 電圧表示をクリック
    await page.click('.changeable.voltage');

    // ダイアログが表示される
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();
    await expect(page.locator('.v-card-title')).toHaveText('Input Voltage');
  });

  test('should input voltage value', async ({ page }) => {
    await page.goto('/?test=true');

    // 電圧表示をクリック
    await page.click('.changeable.voltage');

    // ダイアログが表示されるのを待つ
    await expect(page.locator('.v-dialog[role="dialog"]')).toBeVisible();

    // 数値を入力: 5 . 0
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("0")');

    // Vボタンで確定
    await page.locator('#numberInputTable button').filter({ hasText: /^V$/ }).click();

    // ダイアログが閉じるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();

    // 内部状態が更新されていることを確認
    const setVoltage = await page.evaluate(() => window.APP.device.setVoltage);
    expect(setVoltage).toBe(5.0);
  });

  test('should input current value', async ({ page }) => {
    await page.goto('/?test=true');

    // 電流表示をクリック
    await page.click('.changeable.current');

    // ダイアログが表示されるのを待つ
    await expect(page.locator('.v-dialog[role="dialog"]')).toBeVisible();

    // 数値を入力: 1 . 5
    await page.click('#numberInputTable button:has-text("1")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("5")');

    // Aボタンで確定
    await page.locator('#numberInputTable button').filter({ hasText: /^A$/ }).click();

    // ダイアログが閉じる
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();

    // 内部状態が更新されていることを確認
    const setCurrent = await page.evaluate(() => window.APP.device.setCurrent);
    expect(setCurrent).toBe(1.5);
  });

  test('should input voltage value in mV', async ({ page }) => {
    await page.goto('/?test=true');
    await page.click('.changeable.voltage');
    await expect(page.locator('.v-dialog[role="dialog"]')).toBeVisible();

    // 5 0 0 mV
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.locator('#numberInputTable button').filter({ hasText: /^mV$/ }).click();

    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();

    // 0.5V になっていることを確認
    const setVoltage = await page.evaluate(() => window.APP.device.setVoltage);
    expect(setVoltage).toBe(0.5);
  });

  test('should input current value in mA', async ({ page }) => {
    await page.goto('/?test=true');
    await page.click('.changeable.current');
    await expect(page.locator('.v-dialog[role="dialog"]')).toBeVisible();

    // 5 0 0 mA
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.click('#numberInputTable button:has-text("0")');
    await page.locator('#numberInputTable button').filter({ hasText: /^mA$/ }).click();

    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();

    // 0.5A になっていることを確認
    const setCurrent = await page.evaluate(() => window.APP.device.setCurrent);
    expect(setCurrent).toBe(0.5);
  });

  test('should cancel dialog when clicking cancel button', async ({ page }) => {
    await page.goto('/?test=true');

    // 電圧表示をクリック
    await page.click('.changeable.voltage');

    // ダイアログが表示されるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();

    // 数値を入力
    await page.click('#numberInputTable button:has-text("1")');
    await page.click('#numberInputTable button:has-text("2")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("5")');

    // Cancelボタンをクリック
    await page.click('text=Cancel');

    // ダイアログが閉じる
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
  });

  test('should use backspace button', async ({ page }) => {
    await page.goto('/?test=true');

    // 電圧表示をクリック
    await page.click('.changeable.voltage');

    // ダイアログが表示されるのを待つ
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();

    // 数値を入力
    await page.click('#numberInput button:has-text("1")');

    // Backspaceボタンをクリック
    await page.click('#numberInput button:has-text("⌫")');

    // ダイアログが閉じる（最後の文字を削除すると空になるので、もう一度押すと閉じる）
    await page.click('#numberInput button:has-text("⌫")');

    // ダイアログが閉じる
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
  });
});
