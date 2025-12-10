import { sprintf } from 'https://cdn.jsdelivr.net/npm/sprintf-js@1.1.3/+esm'
import * as Comlink from "https://cdn.jsdelivr.net/npm/comlink@4.4.2/dist/esm/comlink.min.mjs";

import { sleep, functionWithTimeout } from "./utils.js";
import {
	DPS150,
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

	OVP,
	OCP,
	OTP,
	LVP,
	OPP,
} from "./dps-150.js";

const Backend = Comlink.wrap(new Worker("worker.js", { type : "module" }));


Vue.createApp({
	data() {
		return {
			port: null,

			device: {
				inputVoltage: 0,
				setVoltage: 0,
				setCurrent: 0,
				outputVoltage: 0,
				outputCurrent: 0,
				outputPower: 0,
				temperature: 0,

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

				overVoltageProtection: 0,
				overCurrentProtection: 0,
				overPowerProtection: 0,
				overTemperatureProtection: 0,
				lowVoltageProtection: 0,

				brightness: 0,
				volume: 0,
				meteringClosed: false,

				outputCapacity: 0,
				outputEnergy: 0,

				outputClosed: false,
				protectionState: "",
				mode: "CV",

				upperLimitVoltage: 0,
				upperLimitCurrent: 0,

				modelName: "",
				firmwareVersion: "",
				hardwareVersion: "",
			},

			history: [
				{
					time: new Date(),
					v: 0,
					i: 0,
					p: 0,
				}
			],
			historyTableHeaders: [
				{
					title: 'Time',
					align: 'start',
					sortable: true,
					key: 'time',
				},
				{
					title: 'Voltage',
					key: 'v',
					sortable: false,
					align: 'end',
				},
				{
					title: 'Current',
					key: 'i',
					sortable: false,
					align: 'end',
				},
				{
					title: 'Power',
					key: 'p',
					sortable: false,
					align: 'end',
				},
			],

			groupsInput: {
				1: {
					setVoltage: null,
					setCurrent: null,
				},
				2: {
					setVoltage: null,
					setCurrent: null,
				},
				3: {
					setVoltage: null,
					setCurrent: null,
				},
				4: {
					setVoltage: null,
					setCurrent: null,
				},
				5: {
					setVoltage: null,
					setCurrent: null,
				},
				6: {
					setVoltage: null,
					setCurrent: null,
				}
			},

			graphOptions: {
				voltage: true,
				current: true,
				power: true,
				duration: 30,
			},

			showNumberInput: false,
			numberInput: {
				result: "",
				title: "",
				description: "",
				descriptionHtml: "",
				unit: "",
				units: [],
				input: "",
			},

			tab: null,

			connectOverlay: true,

			program: "",
			programRunning: false,
			programRemaining: 0,
			programExamples: [
				{
					name: "Sweep Voltage",
					code: `
						const START = 1;
						const END   = 10;
						const STEP  = 0.1;
						V(START)
						ON()
						SLEEP(1000)
						while (V() + STEP < END) {
						  V(V() + STEP)
						  SLEEP(100)
						}
						SLEEP(1000)
						OFF()
					` 
				},
				{
					name: "Sweep Current",
					code: `
						const START = 0.1;
						const END   = 1;
						const STEP  = 0.01;
						I(START)
						ON()
						SLEEP(1000)
						while (I() + STEP < END) {
						  I(I() + STEP)
						  SLEEP(100)
						}
						SLEEP(1000)
						OFF()
					` 
				},
				{
					name: "Sine Wave",
					code: `
						const CENTER = 10;
						const RIPPLE = 2;
						V(CENTER)
						ON()
						SLEEP(1000)
						times(1000, (i) => {
						  V(Math.sin(i / 20) * RIPPLE + CENTER)
						  SLEEP(50)
						})
						OFF()
					` 
				}
			]
		}
	},

	computed: {
		groups: function () {
			return [1, 2, 3, 4, 5, 6].map((i) => {
				return {
					n: i,
					setVoltage: this.device[`group${i}setVoltage`],
					setCurrent: this.device[`group${i}setCurrent`],
				};
			});
		}
	},

	watch: {
		history: function () {
			this.updateGraph();
		},

		port: function () {
			if (!this.port) {
				this.connectOverlay = true;
			} else {
				this.connectOverlay = false;
			}
		},

		graphOptions: {
			handler: function () {
				this.updateGraph();
			},
			deep: true,
		},
	},

	mounted() {
		console.log("mounted");
		this.init();
		console.log('numberInput');
		console.log(this.numberInput);
//		this.openNumberInput({
//			title: "Input Voltage",
//			description: "Input Voltage",
//			units: ["", "", "mV", "V"],
//			input: "",
//			unit: "V",
//		});


		this.programExamples.forEach((example) => {
			example.code = example.code.trim().replace(/\t+/g, '');
		});
		this.program = this.programExamples[0].code;

		this.updateGraph();

		/*
		window.addEventListener("beforeunload", (event) => {
			event.preventDefault();
			event.returnValue = "";
		});
		*/
	},

	methods :{
		init: async function () {
			console.log(navigator.serial);
			if (!navigator.serial) {
				return;
			}
			this.dps = await new Backend();
			const ports = await navigator.serial.getPorts();
			if (ports.length) {
				this.start(ports[0]);
			}
		},

		connect: async function () {
			console.log('connect');
			// Check for WebSerial API support
			if (!navigator.serial) {
				alert('WebSerial API is not supported in this browser.\n\nPlease use Chrome, Edge, Opera, or another Chromium-based browser to control the DPS-150.');
				return;
			}
			// vid:0x2e3c pid: 0x5740
			this.start(await navigator.serial.requestPort());
		},

		disconnect: async function () {
			if (this.port) {
				await this.dps.stopSerialPort();
				this.port = null;
				console.log('forgot');
			}
		},

		start: async function (port) {
			if (!port) return;
			console.log(port, port.getInfo());

			const portInfo = port.getInfo();

			this.port = port;
			await this.dps.startSerialPort({
				usbVendorId: portInfo.usbVendorId,
				usbProductId: portInfo.usbProductId,
			}, Comlink.proxy((data) => {
				if (!data) {
					// disconnected
					this.port = null;
					return;
				}
				Object.assign(this.device, data);
				if (typeof data.outputVoltage === 'number') {
					if (this.history.length >= 2 &&
						data.outputVoltage === 0 &&
						data.outputCurrent === 0 &&
						data.outputPower   === 0 &&
						this.history[0].v  === 0 &&
						this.history[0].i  === 0 &&
						this.history[0].p  === 0 &&
						this.history[1].v  === 0 &&
						this.history[1].i  === 0 &&
						this.history[1].p  === 0
					) {
						this.history[0].time = new Date();
						return;
					}
					this.history.unshift({
						time: new Date(),
						v: data.outputVoltage,
						i: data.outputCurrent,
						p: data.outputPower,
					});
					this.history = this.history.slice(0, 10000);
				}
			}));

			window.APP = this;
		},

		debug: async function () {
			await this.dps.getAll();
			for (let i = 0; i < 200; i++) {
				const v = (Math.sin(i / 10) + 1) * 3 + 10;
				console.log(v);
				await __DPS.setFloatValue(193, v);
			}
		},

		enable: async function () {
			await this.dps.enable();
		},

		disable: async function () {
			await this.dps.disable();
		},

		startMetering: async function () {
			await this.dps.startMetering();
			await this.dps.getAll();
		},

		stopMetering: async function () {
			await this.dps.stopMetering();
			await this.dps.getAll();
		},

		changeVoltage: async function () {
			const voltage = await this.openNumberInput({
				title: "Input Voltage",
				description: `Input Voltage (max ${this.formatNumber(this.device.upperLimitVoltage)}V)`,
				units: ["", "", "mV", "V"],
				input: this.device.setVoltage,
				unit: "V",
			});
			if (voltage) {
				await this.dps.setFloatValue(VOLTAGE_SET, voltage);
				await this.dps.getAll();
			}
		},

		changeCurrent: async function () {
			const current = await this.openNumberInput({
				title: "Input Current",
				description: `Input Current (max ${this.formatNumber(this.device.upperLimitCurrent)}A)`,
				units: ["", "", "mA", "A"],
				input: this.device.setCurrent,
				unit: "A",
			});
			if (current) {
				await this.dps.setFloatValue(CURRENT_SET, current);
				await this.dps.getAll();
			}
		},

		changeOVP: async function () {
			const voltage = await this.openNumberInput({
				title: "Over Voltage Protection",
				description: ``,
				units: ["", "", "mV", "V"],
				input: this.device.overVoltageProtection,
				unit: "V",
			});
			if (voltage) {
				await this.dps.setFloatValue(OVP, voltage);
				await this.dps.getAll();
			}
		},

		changeOCP: async function () {
			const current = await this.openNumberInput({
				title: "Over Current Protection",
				description: ``,
				units: ["", "", "mA", "A"],
				input: this.device.overCurrentProtection,
				unit: "A",
			});
			if (current) {
				await this.dps.setFloatValue(OCP, current);
				await this.dps.getAll();
			}
		},

		changeOPP: async function () {
			const power = await this.openNumberInput({
				title: "Over Power Protection",
				description: ``,
				units: ["", "", "", "W"],
				input: this.device.overPowerProtection,
				unit: "W",
			});
			if (power) {
				await this.dps.setFloatValue(OPP, power);
				await this.dps.getAll();
			}
		},

		changeOTP: async function () {
			const power = await this.openNumberInput({
				title: "Over Temperature Protection",
				description: ``,
				units: ["", "", "", "℃"],
				input: this.device.overTemperatureProtection,
				unit: "℃",
			});
			if (power) {
				await this.dps.setFloatValue(OTP, power);
				await this.dps.getAll();
			}
		},

		changeLVP: async function () {
			const voltage = await this.openNumberInput({
				title: "Low Voltage Protection",
				description: ``,
				units: ["", "", "mV", "V"],
				input: this.device.lowVoltageProtection,
				unit: "V",
			});
			if (voltage) {
				await this.dps.setFloatValue(LVP, voltage);
				await this.dps.getAll();
			}
		},

		formatNumber: function (n) {
			if (n < 10) {
				return sprintf("%05.3f", n);
			} else {
				return sprintf("%05.2f", n);
			}
		},

		formatNumberForInput: function (number, sep) {
			if (!sep) sep = ',';
			if (typeof number === 'number') {
				number = number.toFixed(3);
			}
			return number.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
		},

		formatDateTime: function (date) {
			return date.toISOString();
		},

		formatProtectionState: function (state) {
			return {
				"": "Normal",
				"OVP": "Over Voltage Protection",
				"OCP": "Over Current Protection",
				"OPP": "Over Power Protection",
				"OTP": "Over Temperature Protection",
				"LVP": "Low Voltage Protection",
				"REP": "Reverse Connection Protection",
			}[state];
		},

		openNumberInput: async function (opts) {
			this.numberInput.result = '';
			this.numberInput.title = opts.title || '';
			this.numberInput.description = opts.description || '';
			this.numberInput.descriptionHtml = opts.descriptionHtml || '';
			this.numberInput.prev  = opts.input || '';
			this.numberInput.unit = opts.unit || '';
			this.numberInput.units = opts.units || '';
			this.numberInput.input = '';
			this.showNumberInput = true;

			console.log('openNumberInput', opts);

			const keyDown = (e) => {
				console.log(e.key);
				this.numberInputChar(e.key);
			};

			window.addEventListener('keydown', keyDown);

			return await new Promise( (resolve, reject) => {
				const cancel = this.$watch('showNumberInput', () => {
					cancel();
					window.removeEventListener('keydown', keyDown);
					console.log('resolve', this.numberInput.result);
					resolve(this.numberInput.result);
				});
			});
		},

		numberInputButton: function (e) {
			const char = e.target.textContent.replace(/\s+/g, '');
			this.numberInputChar(char);
		},

		numberInputChar: function (char) {
			const UNITS = {
				'G': 1e9,
				'M': 1e6,
				'k': 1e3,
				'x1' : 1,
				'm' : 1e-3,
				'\u00b5' : 1e-6,
				'n' : 1e-9,
				'p' : 1e-12,

				'mV' : 1e-3,
				'V' : 1,
				'mA': 1e-3,
				'A': 1,
				'mW': 1e-3,
				'W': 1,

				'℃': 1,
			};

			console.log(JSON.stringify(char));
			if (/^[0-9]$/.test(char)) {
				this.numberInput.input += char;
			} else
			if (char === '.') {
				if (!this.numberInput.input.includes('.')) {
					this.numberInput.input += char;
				}
			} else
			if (char === '\u232B') {
				if (this.numberInput.input.length) {
					this.numberInput.input = this.numberInput.input.slice(0, -1);
				} else {
					this.showNumberInput = false;
				}
			} else
			if (char === '-') {
				if (this.numberInput.input[0] === '-') {
					this.numberInput.input = this.numberInput.input.slice(1);
				} else {
					this.numberInput.input = '-' + this.numberInput.input;
				}
			} else
			if (UNITS[char]) {
				const base = parseFloat(this.numberInput.input);
				this.numberInput.result = base * UNITS[char];
				this.showNumberInput = false;
			}
			console.log(this.numberInput.input, parseFloat(this.numberInput.input));
		},

		setGroup: async function (group) {
			console.log('set group', group);
			const groupNumber = group.n;
			const setVoltage = this.groupsInput[group.n].setVoltage || group.setVoltage;
			const setCurrent = this.groupsInput[group.n].setCurrent || group.setCurrent;

			const cmdVoltage = GROUP1_VOLTAGE_SET + (groupNumber - 1) * 2;
			const cmdCurrent = GROUP1_CURRENT_SET + (groupNumber - 1) * 2;

			await this.dps.setFloatValue(VOLTAGE_SET, setVoltage);
			await this.dps.setFloatValue(CURRENT_SET, setCurrent);
			await this.dps.setFloatValue(cmdVoltage, setVoltage);
			await this.dps.setFloatValue(cmdCurrent, setCurrent);
			await this.dps.getAll();

			this.groupsInput[group.n].setVoltage = null;
			this.groupsInput[group.n].setCurrent = null
		},

		editGroupVoltage: async function (group) {
			const voltage = await this.openNumberInput({
				title: `Edit Group ${group.n} Voltage`,
				description: ``,
				units: ["", "", "mV", "V"],
				input: group.setVoltage,
				unit: "V",
			});
			if (voltage) {
				this.groupsInput[group.n].setVoltage = voltage;
			}
		},

		editGroupCurrent: async function (group) {
			const current = await this.openNumberInput({
				title: `Edit Group ${group.n} Current`,
				description: ``,
				units: ["", "", "mA", "A"],
				input: group.setCurrent,
				unit: "A",
			});
			if (current) {
				this.groupsInput[group.n].setCurrent = current;
			}
		},

		groupChanged: function (group, type) {
			const input = this.groupsInput[group.n];
			if (!type || type === 'V') {
				if (input.setVoltage !== null && input.setVoltage !== group.setVoltage) {
					return true;
				}
			}
			if (!type || type === 'I') {
				if (input.setCurrent !== null && input.setCurrent !== group.setCurrent) {
					return true;
				}
			}
		},

		editBrightness: async function () {
			const brightness = await this.openNumberInput({
				title: "Brightness",
				description: `Max 10`,
				units: ["", "", "", "x1"],
				input: this.device.brightness,
				unit: "/10",
			});
			if (brightness) {
				await this.dps.setByteValue(BRIGHTNESS, brightness);
				await this.dps.getAll();
			}
		},


		editVolume: async function () {
			const volume = await this.openNumberInput({
				title: "Volume",
				description: `Max 10`,
				units: ["", "", "", "x1"],
				input: this.device.volume,
				unit: "/10",
			});
			if (volume) {
				await this.dps.setByteValue(VOLUME, volume);
				await this.dps.getAll();
			}
		},

		updateGraph: function () {
			const voltage = { 
				mode: "lines+markers",
				x: [],
				y: [],
				name: "Voltage",
				line: {
					width: 3,
					color: '#38a410',
					shape: 'linear',
				},
				hovertemplate: '%{y:.3f}V',
			};
			const current = {
				mode: "lines+markers",
				x: [],
				y: [],
				name: "Current",
				yaxis: "y2",
				line: {
					width: 3,
					color: '#e84944',
					shape: 'linear',
				},
				hovertemplate: '%{y:.3f}A',
			};
			const power = {
				mode: "lines+markers",
				x: [],
				y: [],
				name: "Power",
				yaxis: "y3",
				line: {
					width: 3,
					color: '#0097d2',
					shape: 'linear',
				},
				hovertemplate: '%{y:.3f}W',
			};


			for (let i = 0; i < this.history.length; i++) {
				const h = this.history[i];
				voltage.x.push(h.time);
				voltage.y.push(h.v);
				current.x.push(h.time);
				current.y.push(h.i);
				power.x.push(h.time);
				power.y.push(h.p);
				if (i > 60) break;
			}

			const data = [];
			if (this.graphOptions.voltage) {
				data.push(voltage);
			}
			if (this.graphOptions.current) {
				data.push(current);
			}
			if (this.graphOptions.power) {
				data.push(power);
			}

			const layout = {
				title: {text: ''},
				showlegend: false,
				margin: {
					t: 0,
					b: 50,
					l: 0,
					r: 0,
				},
				xaxis: {
					/*
					title: {
						text: "time",
					},
					*/
					domain: [0.1, 0.9],
					// autorange: true,
					type: 'date',
					range: [new Date() - 1000 * this.graphOptions.duration, new Date()],
					tickformat: '%M:%S\n %H'
					/*
					rangeselector: {
						buttons: [
							{
								count: 1,
								label: '1m',
								step: 'minute',
								stepmode: 'backward'
							},
							{
								count: 3,
								label: '3m',
								step: 'minute',
								stepmode: 'backward'
							},
							{
								count: 5,
								label: '5m',
								step: 'minute',
								stepmode: 'backward'
							},
							{
								count: 10,
								label: '10m',
								step: 'minute',
								stepmode: 'backward'
							},
							{
								step: 'all'
							}
						]
					}
					*/
				},
				yaxis: {
					title: {
						text: "V",
						font: {color: '#38a410'}
					},
					tickfont: {color: '#38a410'},
					minallowed: 0,
					rangemode: "tozero",
					autorange: "max",
				},
				yaxis2: {
					title: {
						text: "I",
						font: {color: '#e84944'}
					},
					tickfont: {color: '#e84944'},
					anchor: 'free',
					overlaying: 'y',
					side: 'left',
					position: 0.05,
					minallowed: 0,
					rangemode: "tozero",
					autorange: "max",
				},
				yaxis3: {
					title: {
						text: "P",
						font: {color: '#0097d2'}
					},
					tickfont: {color: '#0097d2'},
					anchor: 'x',
					overlaying: 'y',
					side: 'right',
					minallowed: 0,
					rangemode: "tozero",
					autorange: "max",
				},
			};

			Plotly.react(this.$refs.graph, data, layout, {
				displayModeBar: false,
				responsive: true,
			});
		},


		evaluateDSL: async function (text) {
			const dslFunction = await functionWithTimeout((tempV, tempI, text) => {
				const queue = [];
				const scope = {
					V: (v) => {
						if (v) {
							tempV = v;
							queue.push({type: 'V', args: [v]});
						} else {
							return tempV;
						}
					},
					I: (i) => {
						if (i) {
							tempI = i;
							queue.push({type: 'I', args: [i]});
						} else {
							return tempI;
						}
					},
					ON: () => {
						queue.push({type: 'ON'});
					},
					OFF: () => {
						queue.push({type: 'OFF'});
					},
					SLEEP: (n) => {
						queue.push({type: 'SLEEP', args: [n] });
					},
					times: function (n, f) {
						for (let i = 0; i < n; i++) {
							f(i);
						}
					}
				};

				const argumentNames = Object.keys(scope);
				const argumentValues = argumentNames.map((name) => scope[name]);

				Function.apply(null, argumentNames.concat(text)).apply(null, argumentValues);
				return queue;
			}, 500);


			let queue = [];
			let tempV = this.device.setVoltage;
			let tempI = this.device.setCurrent;
			try {
				queue = await dslFunction(tempV, tempI, text);
			} catch (e) {
				alert(e.message, e)
				return;
			}


			this.programRunning = true;
			this.programRemaining = queue.length;
			console.log('executeCommands');
			await this.dps.executeCommands(queue, Comlink.proxy((n) => {
				this.programRemaining = n;
			}));
			this.programRunning = false;
		},

		runProgram: function () {
			this.evaluateDSL(this.program);
		},

		abortProgram: function () {
			this.dps.abortExecuteCommands();
		},

		resetHistory: function () {
			this.history = [];
		},

		downloadHistory: function () {
			const csv = this.history.map((h) => 
				[ h.time.toISOString(), h.v, h.i, h.p ].join('\t')
			);
			csv.unshift(['Time', 'Voltage', 'Current', 'Power'].join('\t'));
			const blob = new Blob([csv.join('\n')], {type: 'text/tab-separated-values'});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'history.csv';
			a.click();
		},
	}
}).use(Vuetify.createVuetify({
	theme: {
		defaultTheme: 'light' // or dark
	}
})).mount("#app");


