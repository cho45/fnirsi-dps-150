
export async function evaluateDSL(text, initialV = 0, initialI = 0) {
	const dslFunction = functionWithTimeout((tempV, tempI, text) => {
		const queue = [];
		const scope = {
			V: (v) => {
				if (v !== undefined) {
					tempV = v;
					queue.push({type: 'V', args: [v]});
				} else {
					return tempV;
				}
			},
			I: (i) => {
				if (i !== undefined) {
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

		const fn = new Function(...argumentNames, text);
		fn(...argumentValues);
		return queue;
	}, 500);

	return await dslFunction(initialV, initialI, text);
}

export async function sleep(n) {
	return new Promise((resolve) => {
		setTimeout(resolve, n);
	});
}

export function functionWithTimeout(fn, timeout) {
	const workerCode = `
		self.onmessage = (event) => {
		 postMessage( (${fn.toString()}).apply(null, event.data) );
		};
	`;

	return async function (...args) {
		return await new Promise((resolve, reject) => {
			const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" }));
			const worker = new Worker(blobUrl, {
				type: 'module',
				name: 'evaluator',
			});
			
			const cleanup = () => {
				clearTimeout(timer);
				worker.terminate();
				URL.revokeObjectURL(blobUrl);
			};
			
			const timer = setTimeout(() => {
				cleanup();
				reject(new Error('timeout'));
			}, timeout);
			
			worker.addEventListener('message', (event) => {
				cleanup();
				resolve(event.data);
			});
			
			worker.addEventListener('error', (event) => {
				console.log('error', event);
				cleanup();
				reject(event);
			});
			
			worker.postMessage(args);
		});
	};
}

