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
if(args[1].match(/products/g)) {
	main();
}

// main
async function main(id) {
	let client = new vmwClient({username, password}); // return 'configured' client
	await client.login(); // perform login

	// step 4 - profit!
	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	let records = [];
	client.getProducts().then((products) => {
		let links = products.productCategoryList[0].productList;
		links.forEach((item) => {
			let target = item.actions.filter((link) => {
				return (link.linkname == 'View Download Components');
			})[0].target;
			let values = target.split('/');
			records.push({
				name: item.name,
				target: target,
				category: values[3],
				product: values[4],
				version: values[5],
				dlgType: 'PRODUCT_BINARY'
			});
			//dlgTypes//
			//DRIVERS_TOOLS
			//OPEN_SOURCE
			//CUSTOM_ISO
			//ADDONS
		});
		console.log(JSON.stringify(records, null, "\t"));
	});
}
