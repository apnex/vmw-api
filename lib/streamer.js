#!/usr/bin/env node
const stream = require('stream');
const got = require('got');
const ProgressBar = require('progress');
const {promisify} = require('util');
const pipeline = promisify(stream.pipeline);

module.exports = class vmwClient {
	constructor(options) {
                this.options = options;
		// setup stuff
	}
	async download(url, fileName, dstStream) {
		console.log('DOWNLOADING: ' + fileName);
		let bar;
		let current = 0;
		let prevTrans = 0;
		let label = 0;
		let labels = [
			'KB',
			'MB',
			'GB'
		];
		return pipeline(
			got.stream(url)
				.on('request', (request) => {
					//console.log('REQUEST START');
				})
				.on('response', (response) => {
					//console.log('FIRST RESPONSE');
				})
				.on('downloadProgress', (progress) => {
					//let rate = Math.round(bar.curr / ((new Date - bar.start) / 1000) / 1000);
					if(typeof(bar) == 'undefined') {
						let totalBytes = progress.total;
						let total = parseInt(totalBytes / 1024 * 100) / 100; // get KB
						while(total > 99.99) { // scale up
							label++;
							total = parseInt(total / 1024 * 100) / 100;
						}
						bar = new ProgressBar(fileName + ' | [:bar] :percent :etas :curr/' + pad(total) + ' ' + labels[label], {
							complete: '=',
							head: '>',
							incomplete: ' ',
							width: 50,
							renderThrottle: 500,
							total: totalBytes
						});
					} else {
						let chunk = progress.transferred - prevTrans;
						prevTrans = progress.transferred;
						current = progress.transferred;
						for(let i = 0; i <= label; i++) {
							current = parseInt(current / 1024 * 100) / 100;
						}
						bar.tick(chunk, {
							'curr': pad(current)
						});
					}
				}),
			dstStream
		);
	}
}

// pad/truncate zeros to left and right of number
function pad(num) {
	let rgx = /^([^.]+)\.([^.]+)/g
	if(m = rgx.exec(num.toFixed(2).toString())) {
		let left = m[1];
		if(left.length < 2) {
			left = ('00' + left).slice(-2);
		}
		return left + '.' + m[2];
	}
};
