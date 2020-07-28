#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');
const xtable = require('./xtable');
const fs = require('fs');
const CookieFileStore = require('tough-cookie-file-store').FileCookieStore
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

// called from shell
const args = process.argv.splice(2);
if(process.argv[1].match(/product/g)) {
	if(args.length >= 1) {
		main(...args);
	} else {
		console.log('[' + red('ERROR') + ']: usage ' + blue('download.list <category.name>'));
	}
}

// main
async function main(category) {
	// login to my.vmware.com
	let client = new vmwClient({
		cookieJar: new CookieJar(new CookieFileStore('./cookies.json'))
	}); // return 'configured' client
	try {
		// login
		if(!fs.existsSync('./headers.json')) {
			console.log('TESTICLE');
			let headers = await client.login({username, password}); // perform login // return token header
			//console.log(JSON.stringify(headers, null, "\t"));
			fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');
		} else {
			let headers = require('./headers.json');
			client.client = client.base.extend({ // update default client options
				prefixUrl: 'https://my.vmware.com/',
				headers
			});
		}

		// display data
		//let result = await getRelatedDLGList(client, 'vmware_nsx_t_data_center');
		//let result = await getRelatedDLGList(client, 'vmware_nsx_cloud');
		//let result = await getRelatedDLGList(client, 'vmware_vsphere');

		try {
			let result = await getRelatedDLGList(client, category);
			console.log('TESTICLE');

			// build product cache
			let cache = buildFileList(result);

			// try first fetch
			// convert cache to array
			let fetchEntries = Object.entries(cache);

			// shift and attempt first entry
			console.log('Fetching first entries');
			let firstFetch = fetchEntries.shift();
			let newresult = await tryFetch(client, {
				downloadGroup: firstFetch[0],
				productId: Object.keys(firstFetch[1].productId)[0]
			});

			// map remaining entries to parallel call array
			console.log('Fetching remaining entries');
			let fetchList = fetchEntries.map((item) => {
				return fetchFiles(client, {
					downloadGroup: item[0],
					productId: Object.keys(item[1].productId)[0]
				});
			});

			// Resolve all web calls, flatten arrays and display table result
			await Promise.all(fetchList).then((result) => {
				// merge in first result
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
			console.log('Caught the damn error!');
		}
	} catch(error) {
		console.log(error.message);
	}
}

async function tryFetch(client, options) {
	// try call
	// if fail 401 - perform login
	// try call again, if fail for any reason, throw error
	try {
		let result = await fetchFiles(client, options);
		return result;
	} catch(error) {
		if(error.code == 401) {
	                // login
			let headers = await client.login({username, password}); // perform login // return token header
			fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');

			// retry fetch ONCE
			try {
				console.log('Re-authentication completed, trying call again...');
				let result = await fetchFiles(client, options);
				return result;
			} catch(error) {
				console.log('MOOOOOOOO - havavavava');
				console.log(error);
				console.log(error.message);
				console.log('[' + error.code + ']');
			}
		}
	}
}

async function fetchFiles(client, body) {
	// get product header
 	let fileHeader = await client.getDLGHeader(body);

	// check download eligibility
	let fileDetails = await client.getDLGDetails(body);
	let canDownload = fileDetails.eligibilityResponse.eligibleToDownload;

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
				canDownload: canDownload.toString()
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
