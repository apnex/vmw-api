#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');
const streamer = require('./streamer');
const xtable = require('./xtable');
const fs = require('fs');
const CookieFileStore = require('tough-cookie-file-store').FileCookieStore;
const {CookieJar} = require('tough-cookie');

// convert this into vmw.api.js
// handles session persistence
// handles FS operations
// handles file download operations
// handles MD5 checks

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

// init vmw-sdk client
const client = new vmwClient({
	cookieJar: new CookieJar(new CookieFileStore('./cookies.json'))
});

// called from shell
const args = process.argv.splice(2);
if(process.argv[1].match(/vmwcli/g)) {
	/*
	if(args.length >= 1) {
		main(...args);
	} else {
		console.log('[' + red('ERROR') + ']: usage ' + blue('download.list <category.name>'));
	}
	*/
	switch(args[0]) {
		case 'ls':
			if(args.length >= 2) {
				main(args[1]);
			} else {
				listProducts(client);
				//console.log('[' + red('ERROR') + ']: usage ' + blue('ls <path>'));
			}
		break;
		case 'get':
			if(args.length >= 2) {
				cmdGet(args[1]);
			} else {
				console.log('[' + red('ERROR') + ']: usage ' + blue('get <file.path>'));
			}
		break;
		default:
			console.log('No command specified [list, index, refresh, find, get, json]');
		break;
	}
}

// main
async function cmdGet(fileName) {
	let nstream = new streamer();
	try {
		// test account info
		await tryAuth(client);

		// build product cache
		let file = await getDownload(client, fileName);
		nstream.download(file.downloadURL, file.fileName, fs.createWriteStream(fileName));
	} catch(error) {
		console.log(error.message);
	}
}

// main
async function main(category) {
	try {
		// test account info
		await tryAuth(client);

		// build product cache
		let result = await getRelatedDLGList(client, category);
		let fetchEntries = Object.entries(buildFileList(result));

		// map remaining entries to parallel call array
		let fetchList = fetchEntries.map((item) => {
			return fetchFiles(client, {
				downloadGroup: item[0],
				productId: Object.keys(item[1].productId)[0]
			});
		});

		// Resolve all web calls, flatten arrays and display table result
		await Promise.all(fetchList).then((result) => {
			let data = result.flat(1)
			fs.writeFileSync('./fileList.json', JSON.stringify(data, null, "\t"), 'utf8');
			let table = new xtable({data});
			table.run();
			table.out([
				'fileName',
				'fileType',
				'version',
				'releaseDate',
				'fileSize',
				'canDownload'
			]);
		});
	} catch(error) {
		console.log(error.message);
	}
}

async function tryAuth(client) {
	try {
		if(fs.existsSync('./headers.json')) {
			let headers = require('./headers.json');
			client.client = client.base.extend({
				prefixUrl: 'https://my.vmware.com/',
				headers
			});
		} else {
			client.client = client.base.extend({
				prefixUrl: 'https://my.vmware.com/'
			});
		}
		return await client.accountInfo();
	} catch(error) {
		if(error.code == 401) {
	                // login
			console.log('[401]: Clearing stale sessions');
			let headers = await client.login({username, password});
			fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');
			// retry
			try {
				console.log('Re-authentication completed, trying call again...');
				return await client.accountInfo();
			} catch(error) {
				console.log(error);
			}
		}
	}
}

async function fetchFiles(client, body) {
	// get product header
 	let fileHeader = await client.getDLGHeader(body);

	// check download eligibility
	let fileDetails = await client.getDLGDetails(body);
	let canDownload = fileDetails.eligibilityResponse.eligibleToDownload.toString();

	// build file list
	let files = fileDetails.downloadFiles;
	let result = [];
	files.forEach((item) => {
		if(!item.header) {
			result.push({
				fileName: item.fileName,
				title: item.title,
				description: item.description,
				sha1checksum: item.sha1checksum,
				sha256checksum: item.sha256checksum,
				md5checksum: item.md5checksum,
				build: item.build,
				releaseDate: item.releaseDate,
				fileType: item.fileType,
				fileSize: item.fileSize,
				version: item.version,
				uuid: item.uuid,
				productFamily: fileHeader.product.name,
				downloadGroup: body.downloadGroup,
				productId: body.productId,
				dlgType: fileHeader.dlg.type,
				tagId: fileHeader.dlg.tagId,
				canDownload: canDownload
			});
		}
	});
	return result;
}

function buildFileList(result) {
	// BUILD code->[productId] map for result
	let cache = {};
	result.dlgEditionsLists.forEach((item) => {
		item.dlgList.forEach((product) => {
			if(typeof(cache[product.code]) == 'undefined') {
				cache[product.code] = {
					productId: {}
				}
			}
			cache[product.code].productId[product.productId] = 1;
		});
	});
	fs.writeFileSync('./mainIndex.json', JSON.stringify(cache, null, "\t"), 'utf8');
	return cache;
}

async function getRelatedDLGList(client, productName) {
	// format <product>:<train>
	let products = await getProducts(client);
	let product = products.filter((item) => {
		return (item.product == productName);
	})[0];

	let params = {
		category: product.category,
		product: product.product,
		version: product.version,
		dlgType: product.dlgType
	};
	return client.getRelatedDLGList(params);
}

async function getProducts(client) {
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

async function listProducts(client) {
	let result = await getProducts(client);
	result.forEach((item) => {
		console.log(item.product);
	});
}

async function getDownload(client, fileName) {
	// load fileList and retrieve file details
	let data = require('./fileList.json');
	let details = data.filter((file) => {
		return (file.fileName == fileName);
	})[0];

	// fire download request
	if(details.canDownload == 'true') {
		let json = {
			"locale": "en_US",
			"downloadGroup": details.downloadGroup,
			"productId": details.productId,
			"md5checksum": details.md5checksum,
			"tagId": details.tagId,
			"uUId": details.uuid,
			"dlgType": details.dlgType,
			"productFamily": details.productFamily,
			"releaseDate": details.releaseDate,
			"dlgVersion": details.version,
			"isBetaFlow": false
		};
		//console.log(JSON.stringify(json, null, "\t"));
		return client.getDownload(json);
	} else {
		throw new Error('[' + red('ERROR') + ']: Not permitted to download this file, check account entitlement');
	}
}
