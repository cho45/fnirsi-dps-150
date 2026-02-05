import { test, expect } from './fixtures/setup';

test.describe('Program Tab - Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Programタブを表示
    await page.click('text=Program');
    // エディタ（textarea）が表示されるのを待つ
    await expect(page.locator('.v-window-item--active textarea').first()).toBeVisible();
  });

  test('should display default example on load', async ({ page }) => {
    const textarea = page.locator('.v-window-item--active textarea').first();
    const content = await textarea.inputValue();
    
    // 初期状態では "Sweep Voltage" のコードが入っているはず
    expect(content).toContain('const START = 1;');
    expect(content).toContain('V(START)');
    expect(content).toContain('while (V() + STEP < END)');
  });

  test('should switch to Sine Wave example', async ({ page }) => {
    // 1. Examplesボタンをクリックしてメニューを開く
    await page.getByRole('button', { name: 'Examples' }).click();
    
    // 2. "Sine Wave" をクリック
    // v-menuの中身は通常 body 直下に配置されるため、グローバルに探す
    await page.click('text=Sine Wave');
    
    // 3. エディタの内容が Sine Wave 用に更新されたか確認
    const textarea = page.locator('.v-window-item--active textarea').first();
    const content = await textarea.inputValue();
    
    expect(content).toContain('const CENTER = 10;');
    expect(content).toContain('Math.sin(i / 20)');
    expect(content).toContain('times(1000, (i) => {');
  });

  test('should switch to Sweep Current example', async ({ page }) => {
    await page.getByRole('button', { name: 'Examples' }).click();
    await page.click('text=Sweep Current');
    
    const textarea = page.locator('.v-window-item--active textarea').first();
    const content = await textarea.inputValue();
    
    expect(content).toContain('I(START)');
    expect(content).toContain('while (I() + STEP < END)');
  });

  test('should run and abort program', async ({ page }) => {
    // 1. ステッピングモードを有効にする
    await page.evaluate(() => {
      window.APP.dps.setSteppingMode(true);
    });

    // 2. Runボタンをクリック
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // 3. Abortボタンに変わっていることを確認 (実行中状態)
    const abortBtn = page.getByRole('button', { name: /Abort/ });
    await expect(abortBtn).toBeVisible();

    // 4. 数ステップ進めてみる
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.APP.dps.step());
      await page.waitForTimeout(50);
    }

    // まだ Abort ボタンが表示されている
    await expect(abortBtn).toBeVisible();

    // 5. Abortボタンをクリック
    await abortBtn.click();

    // 6. Runボタンに戻っていることを確認
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
    
    // 内部的に steppingMode を解除しておく (クリーンアップ)
    await page.evaluate(() => {
      window.APP.dps.setSteppingMode(false);
      window.APP.dps.step(); // 念のため残っている resolver を解放
    });
  });
});
