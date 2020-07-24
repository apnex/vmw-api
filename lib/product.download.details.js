#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');
const fs = require('fs');

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
if(args[1].match(/product/g)) {
	main();
}

// main
async function main(id) {
	// login to my.vmware.com
	let client = new vmwClient({username, password}); // return 'configured' client
	try {
		// login
		await client.login(); // perform login // return authenticated instance?

		// display data
		let result = await getDLGDetails(client);

		// save data
		console.log(JSON.stringify(result, null, "\t"));
		//fs.writeFileSync('./productIndex.json', JSON.stringify(result, null, "\t"), 'utf8');
	} catch(error) {
		console.log(error.message);
	}
}

async function listProducts(result) {
	// output list
	result.forEach((item) => {
		console.log(item.product);
	});
}

async function getDLGDetails(client, productName) {
	let params = {
		downloadGroup: 'NSX-T-30110',
		productId: 982
	};

	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	return client.getDLGDetails(params);
}
