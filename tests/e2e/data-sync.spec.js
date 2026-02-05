import { test, expect } from './fixtures/setup';

test.describe('Real-time Data Synchronization', () => {
  test('should reflect all device data fields in the UI correctly', async ({ page }) => {
    await page.goto('/?test=true');

    // 1. テストデータの定義
    const testData = {
      temperature: 45.6,
      inputVoltage: 13.8,
      outputVoltage: 5.1234,
      outputCurrent: 0.888,
      outputPower: 4.549,
      mode: 'CC',
      protectionState: 'OVP'
    };

    // 2. データの注入
    await page.evaluate((data) => {
      window.APP.dps.simulateDeviceData(data);
    }, testData);

    // 3. 各要素の検証

    // 温度: toFixed(0) により 46°C
    await expect(page.locator('.v-app-bar .v-chip').filter({ hasText: '°C' })).toContainText('46°C');

    // 入力電圧: 10以上なので 13.80V (formatNumber)
    await expect(page.locator('.v-app-bar .v-chip').filter({ hasText: 'Input:' })).toContainText('13.80V');

    // メインビューの出力値
    // 電圧: 10未満なので 5.123 (単位 V は別span)
    const mainVoltage = page.locator('.main-view .voltage span').first();
    await expect(mainVoltage).toHaveText('5.123');

    // 電流: 10未満なので 0.888
    const mainCurrent = page.locator('.main-view .current span').first();
    await expect(mainCurrent).toHaveText('0.888');

    // 電力: 10未満なので 4.549
    const mainPower = page.locator('.main-view .power span').first();
    await expect(mainPower).toHaveText('4.549');

    // モード: CC チップが表示され、current クラスを持つ
    // Vuetifyのチップは内部に余白等を含む可能性があるため、正規化されたテキストで探す
    const modeChip = page.locator('.main-view .v-chip').filter({ hasText: 'CC' });
    await expect(modeChip).toBeVisible();
    await expect(modeChip).toHaveClass(/current/);

    // 保護状態: OVP が表示される
    const protectionChip = page.locator('.main-view .v-chip').filter({ hasText: 'OVP' });
    await expect(protectionChip).toBeVisible();
  });

  test('should show OK and CV in normal state', async ({ page }) => {
    await page.goto('/?test=true');

    await page.evaluate(() => {
      window.APP.dps.simulateDeviceData({
        mode: 'CV',
        protectionState: ''
      });
    });

    // モード: CV チップが表示され、voltage クラスを持つ
    const modeChip = page.locator('.main-view .v-chip').filter({ hasText: 'CV' });
    await expect(modeChip).toBeVisible();
    await expect(modeChip).toHaveClass(/voltage/);

    // 保護状態: OK が表示される (protectionStateが空の時は OK と表示される仕様)
    const protectionChip = page.locator('.main-view .v-chip').filter({ hasText: 'OK' });
    await expect(protectionChip).toBeVisible();
  });
});
