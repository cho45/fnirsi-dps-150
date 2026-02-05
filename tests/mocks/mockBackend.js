import {
  VOLTAGE_SET,
  CURRENT_SET,
  GROUP1_VOLTAGE_SET,
  GROUP1_CURRENT_SET,
  GROUP2_VOLTAGE_SET,
  GROUP2_CURRENT_SET,
  GROUP3_VOLTAGE_SET,
  GROUP3_CURRENT_SET,
  GROUP4_VOLTAGE_SET,
  GROUP4_CURRENT_SET,
  GROUP5_VOLTAGE_SET,
  GROUP5_CURRENT_SET,
  GROUP6_VOLTAGE_SET,
  GROUP6_CURRENT_SET,
  BRIGHTNESS,
  VOLUME,
} from "../../dps-150.js";

export class MockBackendWorker {
  constructor() {
    this.deviceState = this.getDefaultDeviceState();
    this.dataCallback = null;
    this.callLog = [];
    this.executeCommandsAbortController = null;
  }

  getDefaultDeviceState() {
    return {
      inputVoltage: 0,
      setVoltage: 0,
      setCurrent: 0,
      outputVoltage: 0,
      outputCurrent: 0,
      outputPower: 0,
      temperature: 0,
      outputClosed: false, // 初期状態はOFF (outputClosed=false)
      protectionState: "",
      mode: "CV",
      modelName: "",
      firmwareVersion: "",
      hardwareVersion: "",
      outputCapacity: 0,
      outputEnergy: 0,
      meteringClosed: true,
      // Memory groups
      group1setVoltage: 0,
      group1setCurrent: 0,
      group2setVoltage: 0,
      group2setCurrent: 0,
      group3setVoltage: 0,
      group3setCurrent: 0,
      group4setVoltage: 0,
      group4setCurrent: 0,
      group5setVoltage: 0,
      group5setCurrent: 0,
      group6setVoltage: 0,
      group6setCurrent: 0,
      // Protections
      overVoltageProtection: 0,
      overCurrentProtection: 0,
      overPowerProtection: 0,
      overTemperatureProtection: 0,
      lowVoltageProtection: 0,
      // Settings
      brightness: 0,
      volume: 0,
      // Limits
      upperLimitVoltage: 0,
      upperLimitCurrent: 0,
    };
  }

  // 接続管理
  async startSerialPort(opts, callback) {
    this.dataCallback = callback;
    this.logCall('startSerialPort', [opts, callback]);
    // デバイス初期化シーケンスをシミュレート
    await this.simulateInitSequence();
  }

  async stopSerialPort() {
    this.logCall('stopSerialPort', []);
    this.dataCallback = null;
  }

  // 出力制御
  async enable() {
    this.deviceState.outputClosed = true;
    this.logCall('enable', []);
    this.notifyStateUpdate();
  }

  async disable() {
    this.deviceState.outputClosed = false;
    this.logCall('disable', []);
    this.notifyStateUpdate();
  }

  // メータリング
  async startMetering() {
    this.deviceState.meteringClosed = false;
    this.logCall('startMetering', []);
    this.notifyStateUpdate();
  }

  async stopMetering() {
    this.deviceState.meteringClosed = true;
    this.logCall('stopMetering', []);
    this.notifyStateUpdate();
  }

  // 値設定
  async setFloatValue(id, value) {
    this.logCall('setFloatValue', [id, value]);
    // IDに基づいて状態を更新
    this.updateFloatValueState(id, value);
    this.notifyStateUpdate();
  }

  async setByteValue(id, value) {
    this.logCall('setByteValue', [id, value]);
    // IDに基づいて状態を更新
    this.updateByteValueState(id, value);
    this.notifyStateUpdate();
  }

  // データ取得
  async getAll() {
    this.logCall('getAll', []);
    this.notifyStateUpdate();
    return this.deviceState;
  }

  // プログラム実行
  async executeCommands(queue, progress) {
    this.executeCommandsAbortController = new AbortController();
    const signal = this.executeCommandsAbortController.signal;
    this.logCall('executeCommands', [queue]);

    // コマンドキューを処理
    while (queue.length > 0) {
      progress(queue.length);
      const cmd = queue.shift();
      if (cmd.type === 'V') {
        await this.setFloatValue(VOLTAGE_SET, cmd.args[0]);
      } else if (cmd.type === 'I') {
        await this.setFloatValue(CURRENT_SET, cmd.args[0]);
      } else if (cmd.type === 'ON') {
        await this.enable();
      } else if (cmd.type === 'OFF') {
        await this.disable();
      } else if (cmd.type === 'SLEEP') {
        // 即時実行: sleepしない
      }

      if (signal.aborted) {
        await this.disable();
        break;
      }
    }

    this.executeCommandsAbortController = null;
  }

  async abortExecuteCommands() {
    if (this.executeCommandsAbortController) {
      this.executeCommandsAbortController.abort();
      this.logCall('abortExecuteCommands', []);
      this.executeCommandsAbortController = null;
    }
  }

  // テスト用ヘルパー
  simulateDeviceData(data) {
    Object.assign(this.deviceState, data);
    this.notifyCallback();
  }

  verifyCall(methodName, args) {
    const call = this.callLog.find(c => c.method === methodName);
    if (!args) return !!call;
    return call && JSON.stringify(call.args) === JSON.stringify(args);
  }

  reset() {
    this.deviceState = this.getDefaultDeviceState();
    this.dataCallback = null;
    this.callLog = [];
    this.executeCommandsAbortController = null;
  }

  logCall(method, args) {
    this.callLog.push({ method, args });
  }

  notifyStateUpdate() {
    // 即時実行: 何も待たずに通知
    this.notifyCallback();
  }

  notifyCallback() {
    if (this.dataCallback) {
      this.dataCallback(this.deviceState);
    }
  }

  async simulateInitSequence() {
    // デバイス初期化シーケンスをシミュレート
    this.deviceState.modelName = "DPS-150";
    this.deviceState.firmwareVersion = "v2.1";
    this.deviceState.hardwareVersion = "v1.0";
    this.deviceState.setVoltage = 5.0;
    this.deviceState.setCurrent = 1.0;
    this.deviceState.outputVoltage = 0;
    this.deviceState.outputCurrent = 0;
    this.deviceState.outputPower = 0;
    this.deviceState.inputVoltage = 12.0;
    this.deviceState.temperature = 25.0;
    this.notifyCallback();
  }

  updateFloatValueState(id, value) {
    // DPS-150のIDマップに基づいて状態を更新
    // 簡略版: 基本的な値のみ対応
    if (id === VOLTAGE_SET) {
      this.deviceState.setVoltage = value;
      this.deviceState.outputVoltage = value; // 簡略化: 即時に反映
    } else if (id === CURRENT_SET) {
      this.deviceState.setCurrent = value;
      this.deviceState.outputCurrent = value;
    } else if (id >= GROUP1_VOLTAGE_SET && id <= GROUP6_CURRENT_SET) {
      const index = Math.floor((id - GROUP1_VOLTAGE_SET) / 2) + 1;
      const type = (id - GROUP1_VOLTAGE_SET) % 2 === 0 ? 'setVoltage' : 'setCurrent';
      this.deviceState[`group${index}${type}`] = value;
    }
    // 他のIDも必要に応じて追加
  }

  updateByteValueState(id, value) {
    // バイト値の更新
    if (id === BRIGHTNESS) {
      this.deviceState.brightness = value;
    } else if (id === VOLUME) {
      this.deviceState.volume = value;
    }
  }
}

// グローバル公開（テスト用）
if (typeof window !== 'undefined') {
  window.__MOCK_BACKEND__ = MockBackendWorker;
}
