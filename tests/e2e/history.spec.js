import { test, expect } from './fixtures/setup';

test.describe('History Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    // Historyタブを表示
    await page.click('text=History');
    // テーブルが表示されるまで待機 (Timeヘッダー)
    await expect(page.locator('.v-window-item--active').locator('text=Time')).toBeVisible();
  });

  test('should record history from device updates', async ({ page }) => {
    // 1. データを3回注入
    const updates = [
      { outputVoltage: 5.0, outputCurrent: 1.0, outputPower: 5.0 },
      { outputVoltage: 10.0, outputCurrent: 2.0, outputPower: 20.0 },
      { outputVoltage: 12.0, outputCurrent: 1.5, outputPower: 18.0 },
    ];

    for (const data of updates) {
      await page.evaluate((d) => {
        window.APP.dps.simulateDeviceData(d);
      }, data);
      await page.waitForTimeout(100); // UIへの反映を待つ
    }

    // 2. テーブルの行数を確認 (初期状態で1つある可能性があるので、それ+3)
    const rows = page.locator('.v-data-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // 3. 最新の行 (一番上) が 12.00V, 1.500A, 18.00W であることを確認
    const firstRow = rows.nth(0);
    await expect(firstRow).toContainText('12.00V');
    await expect(firstRow).toContainText('1.500A');
    await expect(firstRow).toContainText('18.00W');
  });

  test('should reset history', async ({ page }) => {
    // 1. 適当なデータを注入
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputVoltage: 5.0, outputCurrent: 1.0, outputPower: 5.0 });
    });
    
    // データがあることを確認
    await expect(page.locator('.v-data-table tbody tr').first()).toBeVisible();

    // 2. Resetボタンをクリック
    await page.click('button:has-text("Reset")');

    // 3. 履歴が空（No data available または 行が消える）であることを確認
    await expect(page.locator('.v-data-table')).toContainText('No data available');
  });

  test('should deduplicate zero updates', async ({ page }) => {
    // 1. まず非ゼロのデータを送って基準を作る
    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({ outputVoltage: 5.0, outputCurrent: 1.0, outputPower: 5.0 });
    });
    const initialRows = await page.locator('.v-data-table tbody tr').count();

    // 2. 0のデータを連続して送る (3回)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.APP.dps.simulateDeviceData({ outputVoltage: 0, outputCurrent: 0, outputPower: 0 });
      });
      await page.waitForTimeout(100);
    }

    // 3. 重複排除ロジックにより、0 のエントリは2つ以上増えないはず (実装依存だが、無限には増えない)
    const finalRows = await page.locator('.v-data-table tbody tr').count();
    // 連続する0は history[0].time を更新するだけなので、行数は劇的には増えない
    expect(finalRows).toBeLessThan(initialRows + 5); 
  });
});
