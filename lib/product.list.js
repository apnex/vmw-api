#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');
const fs = require('fs');
const CookieFileStore = require('tough-cookie-file-store').FileCookieStore;
const {CookieJar} = require('tough-cookie');

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
	let client = new vmwClient({
		cookieJar: new CookieJar(new CookieFileStore('./cookies.json'))
	});
	try {
		// login
		if(!fs.existsSync('./headers.json')) {
			let headers = await client.login({username, password});
			fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');
		} else {
			let headers = require('./headers.json');
			client.client = client.base.extend({ // update default client options
				prefixUrl: 'https://my.vmware.com/',
				headers
			});
		}

		// display data
		let result = await getProducts(client);
		listProducts(result);

		// save data
		fs.writeFileSync('./productIndex.json', JSON.stringify(result, null, "\t"), 'utf8');
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

async function getProducts(client) {
	// step 4 - profit!
	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	let result = [];
	return client.getProducts().then((products) => {
		let links = products.productCategoryList[0].productList;
		links.forEach((item) => {
			let target = item.actions.filter((link) => {
				return (link.linkname == 'View Download Components');
			})[0].target;
			let values = target.split('/');
			result.push({
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
		return result;
	});
}
