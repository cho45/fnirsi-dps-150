import * as Comlink from "https://cdn.jsdelivr.net/npm/comlink@4.4.2/dist/esm/comlink.min.mjs";
import {
	DPS150,
	VOLTAGE_SET,
	CURRENT_SET,
} from "./dps-150.js";

async function sleep(n) {
	return new Promise((resolve) => {
		setTimeout(resolve, n);
	});
}

class Worker {
	constructor() {
	}

	async init() {
	}

	async startSerialPort(opts, cb) {
		console.log('worker startSerialPort', opts, cb);
		const ports = await navigator.serial.getPorts();
		this.port = ports.find(port => {
			const portInfo = port.getInfo();
			return portInfo.usbVendorId === opts.usbVendorId && portInfo.usbProductId === opts.usbProductId;
		});
		if (!this.port) throw "port not found";
		this.callback = cb;
		this.dps = new DPS150(this.port, this.callback);
		try {
			await this.dps.start();
		} catch (e) {
			this.port = null;
			throw e;
		}
		navigator.serial.addEventListener('disconnect', (event) => {
			console.log('disconnected', event.target);
			if (event.target === this.port) {
				this.callback(null);
				this.port = null;
			}
		});
	}

	async stopSerialPort() {
		console.log('worker stopSerialPort');
		if (this.dps) {
			await this.dps.stop();
			await this.port.forget();
			this.port = null;
			this.dps = null;
			this.callback(null);
		}
	}

	async enable() {
		await this.dps.enable();
	}

	async disable() {
		await this.dps.disable();
	}

	async startMetering() {
		await this.dps.startMetering();
	}

	async stopMetering() {
		await this.dps.stopMetering();
	}

	async setFloatValue(id, value) {
		await this.dps.setFloatValue(id, value);
	}

	async setByteValue(id, value) {
		await this.dps.setByteValue(id, value);
	}

	async getAll() {
		await this.dps.getAll();
	}

	async executeCommands(queue, progress) {
		this.executeCommandsAbortController = new AbortController();
		const signal = this.executeCommandsAbortController.signal;
		console.log('executeCommands', queue);
		while (queue.length > 0) {
			progress(queue.length);
			const cmd = queue.shift();
			if (cmd.type === 'V') {
				await this.dps.setFloatValue(VOLTAGE_SET, cmd.args[0]);
			} else
			if (cmd.type === 'I') {
				await this.dps.setFloatValue(CURRENT_SET, cmd.args[0]);
			} else
			if (cmd.type === 'ON') {
				await this.dps.enable();
			} else
			if (cmd.type === 'OFF') {
				await this.dps.disable();
			} else
			if (cmd.type === 'SLEEP') {
				await sleep(cmd.args[0]);
			}
			if (signal.aborted) {
				console.log('aborted');
				this.dps.disable();
				break;
			}
		}
		await sleep(500);
		await this.dps.getAll();
		this.executeCommandsAbortController = null;
	}

	async abortExecuteCommands() {
		if (this.executeCommandsAbortController) {
			this.executeCommandsAbortController.abort();
			this.executeCommandsAbortController = null;
		}
	}
}

Comlink.expose(Worker);


