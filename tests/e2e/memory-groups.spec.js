import { test, expect } from './fixtures/setup';

test.describe('Memory Groups Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Memory Groupsタブを表示
    await page.click('text=Memory Groups');
    await expect(page.locator('.v-window-item--active .groups')).toBeVisible();
  });

  test('should edit M1 voltage as pending and then apply it', async ({ page }) => {
    // 1. 初期状態の確認
    const initialV = await page.evaluate(() => window.APP.device.setVoltage);
    const initialM1V = await page.evaluate(() => window.APP.device.group1setVoltage);

    // 2. M1の電圧を編集 (5.5V)
    const m1VoltageCell = page.locator('.groups tr').filter({ hasText: 'M1' }).locator('td').nth(1);
    await m1VoltageCell.click();
    
    await expect(page.locator('#numberInput[role="dialog"]')).toBeVisible();
    await page.click('#numberInputTable button:has-text("5")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.locator('#numberInputTable button').filter({ hasText: /^V$/ }).click();

    // 3. 一時保存状態の検証
    await expect(m1VoltageCell).toHaveClass(/changed/);
    await expect(m1VoltageCell).toContainText('5.500V');

    // 現在の出力電圧は変わっていないはず
    expect(await page.evaluate(() => window.APP.device.setVoltage)).toBe(initialV);

    // 4. M1ボタンを押して適用
    await page.locator('.groups tr').filter({ hasText: 'M1' }).getByRole('button', { name: /^M1$/, exact: true }).click();

    // 5. 適用後の検証
    // セルの背景色が戻る
    await expect(m1VoltageCell).not.toHaveClass(/changed/);
    
    // 現在の出力電圧が更新される
    expect(await page.evaluate(() => window.APP.device.setVoltage)).toBe(5.5);
    // メモリグループ1の電圧も更新される
    expect(await page.evaluate(() => window.APP.device.group1setVoltage)).toBe(5.5);
  });

  test('should edit and apply multiple values in M2', async ({ page }) => {
    const m2Row = page.locator('.groups tr').filter({ hasText: 'M2' });
    const m2VCell = m2Row.locator('td').nth(1);
    const m2ICell = m2Row.locator('td').nth(2);

    // 電圧を 12V に
    await m2VCell.click();
    await page.click('#numberInputTable button:has-text("1")');
    await page.click('#numberInputTable button:has-text("2")');
    await page.locator('#numberInputTable button').filter({ hasText: /^V$/ }).click();

    // 電流を 2.5A に
    await m2ICell.click();
    await page.click('#numberInputTable button:has-text("2")');
    await page.click('#numberInputTable button:has-text(".")');
    await page.click('#numberInputTable button:has-text("5")');
    await page.locator('#numberInputTable button').filter({ hasText: /^A$/ }).click();

    // 両方 changed クラスを持つ
    await expect(m2VCell).toHaveClass(/changed/);
    await expect(m2ICell).toHaveClass(/changed/);

    // 適用
    await m2Row.getByRole('button', { name: /^M2$/, exact: true }).click();

    // 両方反映される
    expect(await page.evaluate(() => window.APP.device.setVoltage)).toBe(12);
    expect(await page.evaluate(() => window.APP.device.setCurrent)).toBe(2.5);
    expect(await page.evaluate(() => window.APP.device.group2setVoltage)).toBe(12);
    expect(await page.evaluate(() => window.APP.device.group2setCurrent)).toBe(2.5);
    
    await expect(m2VCell).not.toHaveClass(/changed/);
    await expect(m2ICell).not.toHaveClass(/changed/);
  });
});
