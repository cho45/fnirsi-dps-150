import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DPS150, VOLTAGE_SET, CURRENT_SET } from '../dps-150.js';
import { MockSerialPort, mockSerial } from './mocks/webSerial.js';
import { 
  createCommandPacket, 
  createFloatCommandPacket, 
  calculateChecksum,
  floatToLittleEndian,
  createResponsePacket,
  createFloatResponsePacket,
  createMultiFloatResponsePacket,
  createStringResponsePacket,
  createAllResponsePacket
} from './helpers/packet.js';

describe('DPS150', () => {
  let mockPort;
  let callback;
  let dps;

  beforeEach(() => {
    mockPort = new MockSerialPort();
    callback = vi.fn();
    dps = new DPS150(mockPort, callback);
  });

  describe('sendCommand', () => {
    beforeEach(async () => {
      await mockPort.open({ baudRate: 115200 });
    });

    it('数値データでコマンドを正しく送信する', async () => {
      await dps.sendCommand(0xf1, 0xb1, 193, 5);
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 193, 5);
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('配列データでコマンドを正しく送信する', async () => {
      await dps.sendCommand(0xf1, 0xb1, 194, [1, 2, 3, 4]);
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 194, [1, 2, 3, 4]);
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('チェックサムが正しく計算される', async () => {
      await dps.sendCommand(0xf1, 0xa1, 192, 0);
      
      const writtenData = mockPort.getWrittenData();
      const packet = writtenData[0];
      
      // パケット構造: [header, command, type, length, ...data, checksum]
      expect(packet[0]).toBe(0xf1); // header
      expect(packet[1]).toBe(0xa1); // command
      expect(packet[2]).toBe(192);  // type
      expect(packet[3]).toBe(1);    // length (数値0は[0]になる)
      expect(packet[4]).toBe(0);    // data
      
      // チェックサム = (type + length + data) % 256
      const expectedChecksum = (192 + 1 + 0) % 256;
      expect(packet[5]).toBe(expectedChecksum);
    });

    it('writeメソッドが呼ばれ、適切な待機時間がある', async () => {
      const sleepTime = Date.now();
      
      await dps.sendCommand(0xf1, 0xb1, 193, 1);
      
      const elapsed = Date.now() - sleepTime;
      const writtenData = mockPort.getWrittenData();
      
      expect(writtenData).toHaveLength(1);
      expect(elapsed).toBeGreaterThanOrEqual(48); // sleep(50)による待機（タイミング誤差考慮）
    });
  });

  describe('sendCommandFloat', () => {
    beforeEach(async () => {
      await mockPort.open({ baudRate: 115200 });
    });

    it('Float値を正しくリトルエンディアンに変換して送信する', async () => {
      const testValue = 12.5;
      await dps.sendCommandFloat(0xf1, 0xb1, VOLTAGE_SET, testValue);
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createFloatCommandPacket(0xf1, 0xb1, VOLTAGE_SET, testValue);
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('負の値を正しく処理する', async () => {
      const testValue = -5.25;
      await dps.sendCommandFloat(0xf1, 0xb1, CURRENT_SET, testValue);
      
      const writtenData = mockPort.getWrittenData();
      const packet = writtenData[0];
      
      // データ部分（4バイト）を取り出してFloat値に変換
      const dataBytes = packet.slice(4, 8);
      const view = new DataView(dataBytes.buffer);
      const receivedValue = view.getFloat32(0, true); // little endian
      
      expect(receivedValue).toBeCloseTo(testValue, 5);
    });

    it('ゼロ値を正しく処理する', async () => {
      await dps.sendCommandFloat(0xf1, 0xb1, VOLTAGE_SET, 0);
      
      const writtenData = mockPort.getWrittenData();
      const packet = writtenData[0];
      
      const dataBytes = packet.slice(4, 8);
      const view = new DataView(dataBytes.buffer);
      const receivedValue = view.getFloat32(0, true);
      
      expect(receivedValue).toBe(0);
    });
  });

  describe('sendCommandRaw', () => {
    beforeEach(async () => {
      await mockPort.open({ baudRate: 115200 });
    });

    it('生のコマンドデータを送信する', async () => {
      const rawCommand = new Uint8Array([0xf1, 0xb1, 193, 1, 5, 199]);
      
      await dps.sendCommandRaw(rawCommand);
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toEqual(rawCommand);
    });
  });

  describe('parseData', () => {
    it('入力電圧データ (c3=192) を正しく解析する', () => {
      const voltage = 12.5;
      const data = floatToLittleEndian(voltage);
      
      dps.parseData(0xf0, 0xa1, 192, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        inputVoltage: voltage
      });
    });

    it('出力電圧・電流・電力データ (c3=195) を正しく解析する', () => {
      const voltage = 5.0;
      const current = 2.5;
      const power = 12.5;
      const values = [voltage, current, power];
      
      const data = new Uint8Array(12);
      const view = new DataView(data.buffer);
      view.setFloat32(0, voltage, true);
      view.setFloat32(4, current, true);
      view.setFloat32(8, power, true);
      
      dps.parseData(0xf0, 0xa1, 195, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        outputVoltage: voltage,
        outputCurrent: current,
        outputPower: power
      });
    });

    it('温度データ (c3=196) を正しく解析する', () => {
      const temperature = 35.5;
      const data = floatToLittleEndian(temperature);
      
      dps.parseData(0xf0, 0xa1, 196, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        temperature: temperature
      });
    });

    it('出力容量データ (c3=217) を正しく解析する', () => {
      const capacity = 1.25;
      const data = floatToLittleEndian(capacity);
      
      dps.parseData(0xf0, 0xa1, 217, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        outputCapacity: capacity
      });
    });

    it('出力エネルギーデータ (c3=218) を正しく解析する', () => {
      const energy = 15.75;
      const data = floatToLittleEndian(energy);
      
      dps.parseData(0xf0, 0xa1, 218, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        outputEnergy: energy
      });
    });

    it('出力オン/オフ状態 (c3=219) を正しく解析する', () => {
      // 出力ON
      dps.parseData(0xf0, 0xa1, 219, 1, new Uint8Array([1]));
      expect(callback).toHaveBeenCalledWith({ outputClosed: true });
      
      callback.mockClear();
      
      // 出力OFF
      dps.parseData(0xf0, 0xa1, 219, 1, new Uint8Array([0]));
      expect(callback).toHaveBeenCalledWith({ outputClosed: false });
    });

    it('保護状態 (c3=220) を正しく解析する', () => {
      // OVP状態
      dps.parseData(0xf0, 0xa1, 220, 1, new Uint8Array([1]));
      expect(callback).toHaveBeenCalledWith({ protectionState: "OVP" });
      
      callback.mockClear();
      
      // 正常状態
      dps.parseData(0xf0, 0xa1, 220, 1, new Uint8Array([0]));
      expect(callback).toHaveBeenCalledWith({ protectionState: "" });
    });

    it('CC/CVモード (c3=221) を正しく解析する', () => {
      // CCモード
      dps.parseData(0xf0, 0xa1, 221, 1, new Uint8Array([0]));
      expect(callback).toHaveBeenCalledWith({ mode: "CC" });
      
      callback.mockClear();
      
      // CVモード
      dps.parseData(0xf0, 0xa1, 221, 1, new Uint8Array([1]));
      expect(callback).toHaveBeenCalledWith({ mode: "CV" });
    });

    it('モデル名 (c3=222) を正しく解析する', () => {
      const modelName = "DPS-150";
      const data = new Uint8Array(modelName.split('').map(c => c.charCodeAt(0)));
      
      dps.parseData(0xf0, 0xa1, 222, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        modelName: modelName
      });
    });

    it('ハードウェアバージョン (c3=223) を正しく解析する', () => {
      const version = "v1.0";
      const data = new Uint8Array(version.split('').map(c => c.charCodeAt(0)));
      
      dps.parseData(0xf0, 0xa1, 223, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        hardwareVersion: version
      });
    });

    it('ファームウェアバージョン (c3=224) を正しく解析する', () => {
      const version = "v2.1";
      const data = new Uint8Array(version.split('').map(c => c.charCodeAt(0)));
      
      dps.parseData(0xf0, 0xa1, 224, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        firmwareVersion: version
      });
    });

    it('上限電圧 (c3=226) を正しく解析する', () => {
      const voltage = 20.0;
      const data = floatToLittleEndian(voltage);
      
      dps.parseData(0xf0, 0xa1, 226, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        upperLimitVoltage: voltage
      });
    });

    it('上限電流 (c3=227) を正しく解析する', () => {
      const current = 5.0;
      const data = floatToLittleEndian(current);
      
      dps.parseData(0xf0, 0xa1, 227, data.length, data);
      
      expect(callback).toHaveBeenCalledWith({
        upperLimitCurrent: current
      });
    });

    it('全データ (c3=255) を正しく解析する', () => {
      const testData = {
        inputVoltage: 12.0,
        setVoltage: 5.0,
        setCurrent: 2.0,
        outputVoltage: 4.98,
        outputCurrent: 1.95,
        outputPower: 9.71,
        temperature: 28.5,
        group1setVoltage: 3.3,
        group1setCurrent: 1.0,
        overVoltageProtection: 20.0,
        overCurrentProtection: 10.0,
        overPowerProtection: 150.0,
        overTemperatureProtection: 80.0,
        lowVoltageProtection: 1.0,
        brightness: 50,
        volume: 75,
        meteringClosed: false,
        outputCapacity: 1.5,
        outputEnergy: 25.3,
        outputClosed: true,
        protectionState: 0,
        mode: "CC",
        upperLimitVoltage: 30.0,
        upperLimitCurrent: 15.0
      };
      
      // ALLレスポンスパケットのデータ部分を生成
      const data = new Uint8Array(139);
      const view = new DataView(data.buffer);
      
      view.setFloat32(0, testData.inputVoltage, true);
      view.setFloat32(4, testData.setVoltage, true);
      view.setFloat32(8, testData.setCurrent, true);
      view.setFloat32(12, testData.outputVoltage, true);
      view.setFloat32(16, testData.outputCurrent, true);
      view.setFloat32(20, testData.outputPower, true);
      view.setFloat32(24, testData.temperature, true);
      view.setFloat32(28, testData.group1setVoltage, true);
      view.setFloat32(32, testData.group1setCurrent, true);
      view.setFloat32(76, testData.overVoltageProtection, true);
      view.setFloat32(80, testData.overCurrentProtection, true);
      view.setFloat32(84, testData.overPowerProtection, true);
      view.setFloat32(88, testData.overTemperatureProtection, true);
      view.setFloat32(92, testData.lowVoltageProtection, true);
      
      data[96] = testData.brightness;
      data[97] = testData.volume;
      data[98] = testData.meteringClosed ? 0 : 1;
      
      view.setFloat32(99, testData.outputCapacity, true);
      view.setFloat32(103, testData.outputEnergy, true);
      
      data[107] = testData.outputClosed ? 1 : 0;
      data[108] = testData.protectionState;
      data[109] = testData.mode === "CC" ? 0 : 1;
      
      view.setFloat32(111, testData.upperLimitVoltage, true);
      view.setFloat32(115, testData.upperLimitCurrent, true);
      
      dps.parseData(0xf0, 0xa1, 255, data.length, data);
      
      const receivedData = callback.mock.calls[0][0];
      
      // Float値は精度の問題があるためtoBeCloseToで比較
      expect(receivedData.inputVoltage).toBeCloseTo(testData.inputVoltage, 5);
      expect(receivedData.setVoltage).toBeCloseTo(testData.setVoltage, 5);
      expect(receivedData.setCurrent).toBeCloseTo(testData.setCurrent, 5);
      expect(receivedData.outputVoltage).toBeCloseTo(testData.outputVoltage, 5);
      expect(receivedData.outputCurrent).toBeCloseTo(testData.outputCurrent, 5);
      expect(receivedData.outputPower).toBeCloseTo(testData.outputPower, 5);
      expect(receivedData.temperature).toBeCloseTo(testData.temperature, 5);
      expect(receivedData.group1setVoltage).toBeCloseTo(testData.group1setVoltage, 5);
      expect(receivedData.group1setCurrent).toBeCloseTo(testData.group1setCurrent, 5);
      expect(receivedData.overVoltageProtection).toBeCloseTo(testData.overVoltageProtection, 5);
      expect(receivedData.overCurrentProtection).toBeCloseTo(testData.overCurrentProtection, 5);
      expect(receivedData.overPowerProtection).toBeCloseTo(testData.overPowerProtection, 5);
      expect(receivedData.overTemperatureProtection).toBeCloseTo(testData.overTemperatureProtection, 5);
      expect(receivedData.lowVoltageProtection).toBeCloseTo(testData.lowVoltageProtection, 5);
      expect(receivedData.outputCapacity).toBeCloseTo(testData.outputCapacity, 5);
      expect(receivedData.outputEnergy).toBeCloseTo(testData.outputEnergy, 5);
      expect(receivedData.upperLimitVoltage).toBeCloseTo(testData.upperLimitVoltage, 5);
      expect(receivedData.upperLimitCurrent).toBeCloseTo(testData.upperLimitCurrent, 5);
      
      // 非Float値は厳密比較
      expect(receivedData.brightness).toBe(testData.brightness);
      expect(receivedData.volume).toBe(testData.volume);
      expect(receivedData.meteringClosed).toBe(testData.meteringClosed);
      expect(receivedData.outputClosed).toBe(testData.outputClosed);
      expect(receivedData.protectionState).toBe("");
      expect(receivedData.mode).toBe(testData.mode);
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('start()がポートを正しく開く', async () => {
      expect(mockPort.isOpen).toBe(false);

      // startを非同期で実行（startReaderが待機状態になるため）
      const startPromise = dps.start();

      // initCommand() 内の全 sleep(50) を進める (6コマンド分)
      await vi.advanceTimersByTimeAsync(50 * 6);

      expect(mockPort.isOpen).toBe(true);
      expect(mockPort.openOptions).toEqual({
        baudRate: 115200,
        bufferSize: 1024,
        dataBits: 8,
        stopBits: 1,
        flowControl: 'hardware',
        parity: 'none'
      });

      // 初期化コマンドが送信されることを確認
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(6);

      // 1. セッション開始: F1 C1 00 01 01 02
      expect(writtenData[0]).toEqual(new Uint8Array([0xf1, 0xc1, 0x00, 0x01, 0x01, 0x02]));

      // 2. ボーレート設定 (115200 = index 5): F1 B0 00 01 05 06
      expect(writtenData[1]).toEqual(new Uint8Array([0xf1, 0xb0, 0x00, 0x01, 0x05, 0x06]));

      // 3. MODEL_NAME (222) 取得: F1 A1 DE 01 00 DF
      expect(writtenData[2]).toEqual(new Uint8Array([0xf1, 0xa1, 0xde, 0x01, 0x00, 0xdf]));

      // 4. HARDWARE_VERSION (223) 取得: F1 A1 DF 01 00 E0
      expect(writtenData[3]).toEqual(new Uint8Array([0xf1, 0xa1, 0xdf, 0x01, 0x00, 0xe0]));

      // 5. FIRMWARE_VERSION (224) 取得: F1 A1 E0 01 00 E1
      expect(writtenData[4]).toEqual(new Uint8Array([0xf1, 0xa1, 0xe0, 0x01, 0x00, 0xe1]));

      // 6. ALL (255) 取得: F1 A1 FF 01 00 00
      expect(writtenData[5]).toEqual(new Uint8Array([0xf1, 0xa1, 0xff, 0x01, 0x00, 0x00]));

      // クリーンアップ：テスト終了時にreaderをキャンセル
      if (dps.reader) {
        await dps.reader.cancel();
      }
    });

    it('stop()がポートを正しく閉じる', async () => {
      // まずポートを開いてreaderを設定
      await mockPort.open({ baudRate: 115200 });
      // readerのモックを設定
      dps.reader = {
        cancel: vi.fn()
      };

      const stopPromise = dps.stop();

      // stop() 内の sendCommand の sleep(50) を進める
      await vi.advanceTimersByTimeAsync(50);

      await stopPromise;

      expect(mockPort.isOpen).toBe(false);
      expect(dps.reader.cancel).toHaveBeenCalledOnce();

      // セッション終了コマンドが送信されることを確認: F1 C1 00 01 00 01
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toEqual(new Uint8Array([0xf1, 0xc1, 0x00, 0x01, 0x00, 0x01]));
    });
  });

  describe('startReader (実際のパケット処理)', () => {
    beforeEach(async () => {
      await mockPort.open({ baudRate: 115200 });
    });

    afterEach(async () => {
      if (dps.reader) {
        await dps.reader.cancel();
      }
    });

    it('有効なパケットを受信して正しく解析する', async () => {
      // startReaderを非同期で開始
      dps.startReader();
      
      // 少し待ってからパケットを送信
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 入力電圧パケットを送信
      const voltagePacket = createFloatResponsePacket(192, 12.5);
      mockPort.pushReadData(voltagePacket);
      
      // コールバックが呼ばれるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalledWith({
        inputVoltage: 12.5
      });
    });

    it('複数のパケットを連続して処理する', async () => {
      dps.startReader();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 複数のパケットを連続送信
      const voltagePacket = createFloatResponsePacket(192, 15.0);
      const temperaturePacket = createFloatResponsePacket(196, 25.5);
      
      mockPort.pushReadData(voltagePacket);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockPort.pushReadData(temperaturePacket);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, { inputVoltage: 15.0 });
      expect(callback).toHaveBeenNthCalledWith(2, { temperature: 25.5 });
    });

    it('不正なチェックサムのパケットを適切にスキップする', async () => {
      dps.startReader();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 不正なチェックサムのパケットを作成
      const invalidPacket = createFloatResponsePacket(192, 12.5);
      invalidPacket[invalidPacket.length - 1] = 0xFF; // 不正なチェックサム
      
      // 有効なパケットと不正なパケットを含むデータを送信
      const validPacket = createFloatResponsePacket(196, 30.0);
      const combinedData = new Uint8Array(invalidPacket.length + validPacket.length);
      combinedData.set(invalidPacket, 0);
      combinedData.set(validPacket, invalidPacket.length);
      
      mockPort.pushReadData(combinedData);
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // 修正後：不正なパケットはスキップされ、有効なパケットのみ処理される
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ temperature: 30.0 });
    });

    it('単独の不正なチェックサムパケットが処理される', async () => {
      dps.startReader();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 不正なチェックサムのパケットのみ送信
      const invalidPacket = createFloatResponsePacket(192, 12.5);
      invalidPacket[invalidPacket.length - 1] = 0xFF; // 不正なチェックサム
      
      mockPort.pushReadData(invalidPacket);
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // 不正なパケットなのでコールバックは呼ばれない（正しい動作）
      expect(callback).not.toHaveBeenCalled();
      
      // その後、有効なパケットを送信すれば正常に処理される
      const validPacket = createFloatResponsePacket(196, 25.0);
      mockPort.pushReadData(validPacket);
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ temperature: 25.0 });
    });
  });

  describe('ユーティリティメソッド', () => {
    beforeEach(async () => {
      await mockPort.open({ baudRate: 115200 });
    });

    it('setFloatValue()がFloat値コマンドを送信する', async () => {
      const testValue = 5.5;
      
      await dps.setFloatValue(VOLTAGE_SET, testValue);
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createFloatCommandPacket(0xf1, 0xb1, VOLTAGE_SET, testValue);
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('setByteValue()がバイト値コマンドを送信する', async () => {
      const testValue = 128;
      
      await dps.setByteValue(214, testValue); // BRIGHTNESS
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 214, testValue);
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('enable()が出力オンコマンドを送信する', async () => {
      await dps.enable();
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 219, 1); // OUTPUT_ENABLE
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('disable()が出力オフコマンドを送信する', async () => {
      await dps.disable();
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 219, 0); // OUTPUT_ENABLE
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('startMetering()がメタリング開始コマンドを送信する', async () => {
      await dps.startMetering();
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 216, 1); // METERING_ENABLE
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('stopMetering()がメタリング停止コマンドを送信する', async () => {
      await dps.stopMetering();
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xb1, 216, 0); // METERING_ENABLE
      expect(writtenData[0]).toEqual(expectedPacket);
    });

    it('getAll()が全データ取得コマンドを送信する', async () => {
      await dps.getAll();
      
      const writtenData = mockPort.getWrittenData();
      expect(writtenData).toHaveLength(1);
      
      const expectedPacket = createCommandPacket(0xf1, 0xa1, 255, 0); // ALL
      expect(writtenData[0]).toEqual(expectedPacket);
    });
  });

  describe('ログ出力の検証', () => {
    it('start()時に適切なログが出力される', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // start()を非同期で実行（startReaderが待機状態になる）
      const startPromise = dps.start();
      
      // 少し待ってからログを確認
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith('start', mockPort);
      expect(consoleSpy).toHaveBeenCalledWith('reading...');
      
      consoleSpy.mockRestore();
      
      // クリーンアップ
      if (dps.reader) {
        await dps.reader.cancel();
      }
    });

    it('stop()時に適切なログが出力される', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await mockPort.open({ baudRate: 115200 });
      dps.reader = { cancel: vi.fn() };
      
      await dps.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('stop');
      
      consoleSpy.mockRestore();
    });
  });
});
