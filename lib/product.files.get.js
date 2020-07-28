#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.client');
const streamer = require('./streamer');
const fs = require('fs');
const params = require('./params.json');
const CookieFileStore = require('tough-cookie-file-store').FileCookieStore
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
const args = process.argv.splice(2);
if(process.argv[1].match(/product/g)) {
	if(args.length >= 1) {
		main(...args);
	} else {
		console.log('[' + red('ERROR') + ']: usage ' + blue('download.get <file.name>'));
	}
}

// main
async function main(fileName) {
	let client = new vmwClient({
		cookieJar: new CookieJar(new CookieFileStore('./cookies.json'))
	}); // return 'configured' client
	let nstream = new streamer();
	try {
		// login
		if(!fs.existsSync('./headers.json')) {
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

		// download file
		// try/catch 401 unauthorized
		try {
			let file = await getDownload(client, fileName);
			nstream.download(file.downloadURL, file.fileName, fs.createWriteStream(fileName));
		} catch(error) {
			let headers = await client.login({username, password}); // perform login // return token header
			//console.log(JSON.stringify(headers, null, "\t"));
			fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');
			let file = await getDownload(client, fileName);
			nstream.download(file.downloadURL, file.fileName, fs.createWriteStream(fileName));

			console.log('Caught the damn error');
			//console.log(error.message);
		}
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
}

async function getDownload(client, fileName) {
	// load fileList and retrieve file details
	let data = require('./fileList.json');
	let details = data.filter((file) => {
		return (file.fileName == fileName);
	})[0];

	// fire download request
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
}
