import { test as base } from '@playwright/test';

// navigator.serial をモックする fixture
export const test = base.extend({
  page: async ({ page }, use) => {
    // navigator.serial をモック
    await page.addInitScript(() => {
      const mockPort = {
        getInfo: () => ({
          usbVendorId: 0x2e3c,
          usbProductId: 0x5740,
        }),
        open: async () => {},
        close: async () => {},
      };

      if (!navigator.serial) {
        Object.defineProperty(navigator, 'serial', {
          value: {
            requestPort: async () => mockPort,
            getPorts: async () => [],
          },
          writable: false,
          configurable: true,
        });
      } else {
        navigator.serial.requestPort = async () => mockPort;
        navigator.serial.getPorts = async () => [];
      }
    });

    // ensureConnected ヘルパーを追加
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      await originalGoto(url, options);
      // ?test=true 且つ noconnect がない場合は自動的に接続
      if (url.includes('?test=true') && !url.includes('noconnect')) {
        await page.locator('#app > div > div > div > div.v-overlay__content > div > p:nth-child(2) > button').click();
        await page.waitForTimeout(500);
      }
    };

    // コンソールログとエラーを監視
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error('[PAGE ERROR]', text);
      } else {
        console.log('[PAGE]', text);
      }
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
