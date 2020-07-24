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
		let result = await getDownload(client);
		makeScript(result);

	} catch(error) {
		console.log(error.message);
	}
}

async function makeScript(result) {
	// save data
	console.log(JSON.stringify(result, null, "\t"));
	let value = 'wget';
	value += " -O " + result.fileName + " '" + result.downloadURL + "'";
	fs.writeFileSync('./test.sh', value);

	let params = result.downloadURL.split('?');
	console.log(decodeURI(params[1]));

	const newparams = new URLSearchParams('?' + params);

	newparams.forEach((item) => {
		console.log(item);
	});
	//console.log(JSON.stringify(newparams, null, "\t"));

	/*
	result.forEach((item) => {
		console.log(item.product);
	});
	*/
}

async function testDownload() {
	//20928a92d02d8dd24e4cea11f
	//db043300884bc5662bb0c5c3ac416775
	let test = {
		"custnumber": "cHBwcGp0JWRAJQ==",
		"sourcefilesize": "29.52 MB",
		"dlgcode":"NSX-T-301",
		"languagecode": "en",
		"source": "DOWNLOADS",
		"downloadtype": "manual",
		"eula": "Y",
		"downloaduuid": "84ac7a4c-098d-4a4b-9d54-9b217b270424",
		"purchased": "Y",
		"dlgtype": "Product Binaries",
		"productfamily":"VMware NSX-T Data Center"
	};
}

async function getDownload(client, productName) {
	let json = {
		//"locale": "en_US",
		"downloadGroup": "NSX-T-301",
		"productId": "982",
		"md5checksum": "2fd5a8621cbea9c3693f2626bf5fb4ca",
		"tagId": 12097,
		"uUId": "28c04bd9-8aaa-4997-9dd7-f1fec4ad49ff",
		"dlgType": "Product Binaries",
		"productFamily": "VMware NSX-T Data Center",
		"releaseDate": "2020-06-23",
		//"dlgVersion": "3.0.1",
		//"isBetaFlow": false
	};
	/*
	let json = {
		"locale": "en_US",
		"downloadGroup": "NSX-T-301",
		"productId": "982",
		"md5checksum": details.md5checksum,
		//"tagId": 12097,
		"uUId": details.uuid,
		"dlgType": "Product Binaries",
		"productFamily":"VMware NSX-T Data Center",
		"releaseDate": details.releaseDate,
		"dlgVersion": details.version,
		"isBetaFlow": false
	};
	*/

	console.log(JSON.stringify(json, null, "\t"));
	//console.log(JSON.stringify(await client.getProducts(), null, "\t"));
	let result = [];
	return client.getDownload(json); //.then((header) => {
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
		//return header;
	//});
}
