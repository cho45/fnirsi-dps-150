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
    await page.click('#numberInputTable button:has-text("V")');

    // ダイアログが閉じる
    await expect(page.locator('#numberInput[role="dialog"]')).not.toBeVisible();
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
