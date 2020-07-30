#!/usr/bin/env node
const storage = require('node-persist');
const cache = storage.create({
	dir: './cache/',
	stringify: JSON.stringify,
	parse: JSON.parse,
	encoding: 'utf8',
	logging: false,
	ttl: 2 * 60 * 1000,
	expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
	forgiveParseErrors: false
});

main();
async function main() {
	await cache.init();

	//await storage.setItem('name', 'yourname')
	/*
	await cache.setItem('naasdme', {
		name: 'yourname'
	});
	await cache.setItem('anaasdme', {
		name: 'yourname'
	});
	*/
	console.log(await cache.getItem('naasdme')); // yourname
}
