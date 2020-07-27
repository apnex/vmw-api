#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const params = require('./params.json');
const xtable = require('./xtable');
const fs = require('fs');

// convert this into vmw.api.js

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
	let client = new vmwClient({username, password}); // return 'configured' client
	try {
		// login
		await client.login(); // perform login // return authenticated instance?

		// display data
		//let result = await getRelatedDLGList(client, 'vmware_nsx_t_data_center');
		//let result = await getRelatedDLGList(client, 'vmware_nsx_cloud');
		//let result = await getRelatedDLGList(client, 'vmware_vsphere');
		let result = await getRelatedDLGList(client, category);

		// get product cache
		let cache = buildFileList(result);
		let fetchList = Object.keys(cache).map((key) => {
			return fetchFiles(client, {
				downloadGroup: key,
				productId: Object.keys(cache[key].productId)[0]
			});
		});

		// Resolve all calls, flatten arrays and display table result
		Promise.all(fetchList).then((result) => {
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
	console.log(JSON.stringify(result, null, "\t"));
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

	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	let result = [];
	return client.getRelatedDLGList(params).then((header) => {
		/*
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
		});
		*/
		//return result;
		return header;
	});
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
