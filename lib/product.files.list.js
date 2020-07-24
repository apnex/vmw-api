#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const xtable = require('./xtable');
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

		// get data
		let result = await getDLGDetails(client);
		let data = listFiles(result);

		// display data
		let table = new xtable({data});
		table.run();
		table.out([
			'fileName',
			'fileType',
			'fileSize'
		]);

		// save data
		//fs.writeFileSync('./productIndex.json', JSON.stringify(result, null, "\t"), 'utf8');
	} catch(error) {
		console.log(error.message);
	}
}

function listFiles(fileDetails) {
		let files = fileDetails.downloadFiles;

		let result = files.flatMap((item) => {
			if(!item.header) {
				return [{
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
					uuid: item.uuid
				}]
			} else {
				return [];
			}
		});

		/*let result = [];
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
					uuid: item.uuid
				});
			}
		});*/
		return result;
}

async function getDLGDetails(client, productName) {
	return client.getDLGDetails({
		//downloadGroup: 'NSX-T-300',
		downloadGroup: 'VRNI-530',
		productId: 982
	});
}
