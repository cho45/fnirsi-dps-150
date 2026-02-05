import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep, functionWithTimeout, evaluateDSL } from '../utils.js';

describe('utils.js (browser environment)', () => {
  describe('sleep()', () => {
    it('指定時間待機する', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(150);
    });

    it('Promiseを返す', () => {
      const result = sleep(10);
      expect(result).toBeInstanceOf(Promise);
    });

    it('ゼロミリ秒でも動作する', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });

    it('負の値でも即座に解決する', async () => {
      const start = Date.now();
      await sleep(-100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });

    it('非数値の場合はNaNミリ秒待つ（即座に解決）', async () => {
      const start = Date.now();
      await sleep('not a number');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('functionWithTimeout()', () => {
    it('関数を正常に実行する', async () => {
      const testFn = (a, b) => a + b;
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      const result = await wrappedFn(2, 3);
      expect(result).toBe(5);
    });

    it('タイムアウト時にエラーをスローする', async () => {
      const slowFn = () => {
        let sum = 0;
        for (let i = 0; i < 1000000000; i++) {
          sum += i;
        }
        return sum;
      };
      
      const wrappedFn = functionWithTimeout(slowFn, 100);
      
      await expect(wrappedFn()).rejects.toThrow('timeout');
    });

    it('引数を正しく渡す', async () => {
      const testFn = (name, age) => `${name} is ${age} years old`;
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      const result = await wrappedFn('Alice', 30);
      expect(result).toBe('Alice is 30 years old');
    });

    it('複数の引数を処理する', async () => {
      const testFn = (...args) => args.reduce((sum, val) => sum + val, 0);
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      const result = await wrappedFn(1, 2, 3, 4, 5);
      expect(result).toBe(15);
    });

    it('戻り値が正しく返される', async () => {
      const testFn = () => ({ name: 'test', value: 42 });
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      const result = await wrappedFn();
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('Worker内でエラーが発生した場合', async () => {
      const errorFn = () => {
        throw new Error('Worker error');
      };
      
      const wrappedFn = functionWithTimeout(errorFn, 1000);
      
      await expect(wrappedFn()).rejects.toThrow("Worker error");
    });

    it('関数内でthisを使用しない場合でも動作する', async () => {
      const arrowFn = (x) => x * 2;
      const wrappedFn = functionWithTimeout(arrowFn, 1000);
      
      const result = await wrappedFn(21);
      expect(result).toBe(42);
    });

    it('同期的な関数も処理できる', async () => {
      const syncFn = (a, b) => a - b;
      const wrappedFn = functionWithTimeout(syncFn, 1000);
      
      const result = await wrappedFn(10, 3);
      expect(result).toBe(7);
    });

    it('タイムアウト後にWorkerが適切に終了する', async () => {
      const slowFn = () => {
        while (true) {} // 無限ループ
      };
      
      const wrappedFn = functionWithTimeout(slowFn, 50);
      
      const startTime = Date.now();
      await expect(wrappedFn()).rejects.toThrow('timeout');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(100);
    });

    it('ブラウザ環境でのみ動作する（Web Worker APIが必要）', () => {
      expect(typeof Worker).toBe('function');
      expect(typeof Blob).toBe('function');
      expect(typeof URL.createObjectURL).toBe('function');
    });

    it('負のタイムアウト値でも動作する', async () => {
      const testFn = () => 'immediate';
      const wrappedFn = functionWithTimeout(testFn, -100);
      
      await expect(wrappedFn()).rejects.toThrow('timeout');
    });

    it('非常に大きなタイムアウト値でも動作する', async () => {
      const testFn = (x) => x * 3;
      const wrappedFn = functionWithTimeout(testFn, 999999999);
      
      const result = await wrappedFn(14);
      expect(result).toBe(42);
    });

    it('関数ではない引数を渡した場合のエラー処理', async () => {
      const notAFunction = 'not a function';
      const wrappedFn = functionWithTimeout(notAFunction, 1000);
      
      await expect(wrappedFn()).rejects.toThrow();
    });
  });

  describe('メモリリーク対策', () => {
    let createObjectURLSpy;
    let revokeObjectURLSpy;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;
    let createdURLs;

    beforeEach(() => {
      createdURLs = [];
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      
      createObjectURLSpy = vi.fn((blob) => {
        const url = originalCreateObjectURL(blob);
        createdURLs.push(url);
        return url;
      });
      
      revokeObjectURLSpy = vi.fn((url) => {
        originalRevokeObjectURL(url);
      });
      
      URL.createObjectURL = createObjectURLSpy;
      URL.revokeObjectURL = revokeObjectURLSpy;
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('正常終了時にrevokeObjectURLが呼ばれる', async () => {
      const testFn = (a, b) => a + b;
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      await wrappedFn(2, 3);
      
      // createObjectURLが1回呼ばれた
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      
      // 少し待ってからrevokeObjectURLが呼ばれることを確認
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // cleanup関数によりrevokeObjectURLが呼ばれることを確認
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdURLs[0]);
    });

    it('タイムアウト時にrevokeObjectURLが呼ばれる', async () => {
      const slowFn = () => {
        let sum = 0;
        for (let i = 0; i < 1000000000; i++) {
          sum += i;
        }
        return sum;
      };
      
      const wrappedFn = functionWithTimeout(slowFn, 50);
      
      await expect(wrappedFn()).rejects.toThrow('timeout');
      
      // createObjectURLが1回呼ばれた
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      
      // 少し待ってからrevokeObjectURLが呼ばれることを確認
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // cleanup関数によりrevokeObjectURLが呼ばれることを確認
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdURLs[0]);
    });

    it('エラー時にrevokeObjectURLが呼ばれる', async () => {
      const errorFn = () => {
        throw new Error('Test error');
      };
      
      const wrappedFn = functionWithTimeout(errorFn, 1000);
      
      await expect(wrappedFn()).rejects.toThrow();
      
      // createObjectURLが1回呼ばれた
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      
      // 少し待ってからrevokeObjectURLが呼ばれることを確認
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // cleanup関数によりrevokeObjectURLが呼ばれることを確認
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdURLs[0]);
    });

    it('複数回実行してもメモリリークしない', async () => {
      const testFn = (x) => x * 2;
      const wrappedFn = functionWithTimeout(testFn, 1000);
      
      // 3回実行
      for (let i = 0; i < 3; i++) {
        await wrappedFn(i);
      }
      
      // createObjectURLが3回呼ばれた
      expect(createObjectURLSpy).toHaveBeenCalledTimes(3);
      
      // 少し待ってからrevokeObjectURLも3回呼ばれることを確認
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // cleanup関数によりrevokeObjectURLが呼ばれることを確認
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(3);
      
      // 作成されたすべてのURLが解放されたことを確認
      createdURLs.forEach((url, index) => {
        expect(revokeObjectURLSpy).toHaveBeenNthCalledWith(index + 1, url);
      });
    });
  });

  describe('evaluateDSL()', () => {
    it('基本的なVコマンドを解析する', async () => {
      const code = 'V(5.0)';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [5.0] }
      ]);
    });

    it('基本的なIコマンドを解析する', async () => {
      const code = 'I(1.5)';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'I', args: [1.5] }
      ]);
    });

    it('ON/OFFコマンドを解析する', async () => {
      const code = 'ON()';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'ON' }
      ]);
    });

    it('SLEEPコマンドを解析する', async () => {
      const code = 'SLEEP(1000)';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'SLEEP', args: [1000] }
      ]);
    });

    it('複数のコマンドを順番に解析する', async () => {
      const code = `
        V(5.0)
        I(1.0)
        ON()
        SLEEP(100)
        OFF()
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [5.0] },
        { type: 'I', args: [1.0] },
        { type: 'ON' },
        { type: 'SLEEP', args: [100] },
        { type: 'OFF' }
      ]);
    });

    it('V()で現在の電圧値を取得できる', async () => {
      const code = `
        V(5.0)
        const v1 = V()
        V(v1 + 1.0)
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [5.0] },
        { type: 'V', args: [6.0] }
      ]);
    });

    it('I()で現在の電流値を取得できる', async () => {
      const code = `
        I(1.0)
        const i1 = I()
        I(i1 + 0.5)
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'I', args: [1.0] },
        { type: 'I', args: [1.5] }
      ]);
    });

    it('times()でループを展開する', async () => {
      const code = `
        times(3, (i) => {
          V(i * 1.0)
        })
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [0] },
        { type: 'V', args: [1] },
        { type: 'V', args: [2] }
      ]);
    });

    it('whileループを展開する', async () => {
      const code = `
        let i = 0
        while (i < 3) {
          V(i * 1.0)
          i = i + 1
        }
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [0] },
        { type: 'V', args: [1] },
        { type: 'V', args: [2] }
      ]);
    });

    it('初期電圧・電流値を引き継ぐ', async () => {
      const code = `
        const v1 = V()
        const i1 = I()
        V(v1 + 1.0)
        I(i1 + 0.5)
      `;
      const queue = await evaluateDSL(code, 10.0, 2.0);

      expect(queue).toEqual([
        { type: 'V', args: [11.0] },
        { type: 'I', args: [2.5] }
      ]);
    });

    it('複雑な式を解析する', async () => {
      const code = `
        const START = 1;
        const END = 10;
        const STEP = 0.1;
        V(START)
        ON()
        SLEEP(1000)
        while (V() + STEP < END) {
          V(V() + STEP)
          SLEEP(100)
        }
        SLEEP(1000)
        OFF()
      `;
      const queue = await evaluateDSL(code, 0, 0);

      // 最初の V(1)
      expect(queue[0]).toEqual({ type: 'V', args: [1] });
      // ON()
      expect(queue[1]).toEqual({ type: 'ON' });
      // SLEEP(1000)
      expect(queue[2]).toEqual({ type: 'SLEEP', args: [1000] });
      // whileループ: 1.1, 1.2, ..., 9.9 (89回)
      // 最後の SLEEP(1000) と OFF()
      expect(queue[queue.length - 2]).toEqual({ type: 'SLEEP', args: [1000] });
      expect(queue[queue.length - 1]).toEqual({ type: 'OFF' });
    });

    it('タイムアウト時にエラーをスローする', async () => {
      const code = `
        while (true) {
          // 無限ループ
        }
      `;

      await expect(evaluateDSL(code, 0, 0)).rejects.toThrow('timeout');
    });

    it('構文エラー時にエラーをスローする', async () => {
      const code = `
        V(5.0
        // 閉じ括弧が不足
      `;

      await expect(evaluateDSL(code, 0, 0)).rejects.toThrow();
    });

    it('const宣言を正しく処理する', async () => {
      const code = `
        const VOLTAGE = 5.0;
        const CURRENT = 1.0;
        V(VOLTAGE)
        I(CURRENT)
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [5.0] },
        { type: 'I', args: [1.0] }
      ]);
    });

    it('Math関数を使用する', async () => {
      const code = `
        V(Math.sin(0) * 10 + 10)
      `;
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([
        { type: 'V', args: [10] }
      ]);
    });

    it('空のコードでは空のqueueを返す', async () => {
      const code = '';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([]);
    });

    it('コメントのみのコードでは空のqueueを返す', async () => {
      const code = '// This is a comment\n/* Multi\nline\ncomment */';
      const queue = await evaluateDSL(code, 0, 0);

      expect(queue).toEqual([]);
    });
  });
});
