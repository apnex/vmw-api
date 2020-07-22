#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');

// ignore self-signed certificate
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
var username = params.username;
var password = params.password;

// colours
const chalk = require('chalk');
const red = chalk.bold.red;
const orange = chalk.keyword('orange');
const green = chalk.green;
const blue = chalk.blueBright;

// called from shell
const args = process.argv;
if(args[1].match(/categories/g)) {
	main();
}

// main
async function main(id) {
	let client = new vmwClient({username, password}); // return 'configured' client
	await client.login(); // perform login

	// step 4 - profit!
	console.log(JSON.stringify(await client.accountInfo(), null, "\t"));
	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	console.log(JSON.stringify(await client.getProductHeader(), null, "\t"));
	//console.log(JSON.stringify(await client.getRelatedDLGList(), null, "\t"));
	//console.log(JSON.stringify(await client.getDLGHeader(), null, "\t"));
	//console.log(JSON.stringify(await client.getDLGDetails(), null, "\t"));
	//console.log(JSON.stringify(await client.eulaAccept(), null, "\t"));
	console.log(JSON.stringify(await client.getDownload(), null, "\t"));
}
