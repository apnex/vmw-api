#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.api');
const params = require('./params.json');
const streamer = require('./streamer');
const fs = require('fs');
const xtable = require('./xtable');
const md5File = require('md5-file');

// convert this into vmw.cli.js
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

// init vmw-api client
const client = new vmwClient({username, password});

// called from shell
const args = process.argv.splice(2);
if(process.argv[1].match(/vmw.cli/g)) {
	switch(args[0]) {
		case 'ls':
			if(args.length >= 2) {
				cmdPath(args[1]);
			} else {
				list();
			}
		break;
		case 'cp':
			if(args.length >= 2) {
				cmdGet(args[1]);
			} else {
				console.log('[' + red('ERROR') + ']: usage ' + blue('get <file.path>'));
			}
		break;
		case 'clear':
			cmdClear();
		break;
		default:
			console.log(blue('<cmd>'));
			[
				'ls',
				'cp',
				'clear'
			].forEach((cmd) => {console.log(cmd)});
		break;
	}
}

// main
async function main(category, version, type) {
	client.main(category, version, type).then((data) => {
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
	}).catch((error) => {
		//console.log('[CLI-ERROR]: ' + error.message);
		console.log(error.message);
	});
}

// list
async function list() {
	client.getProducts().then((result) => {;
		console.log(blue('<category>'));
		result.forEach((item) => {
			console.log(item.product);
		});
	});
}

async function cmdClear() {
	await client.clear();
}

async function cmdPath(string) {
	// need to normalise path to [category, version, type] before calling main
	//console.log('Path test [' + string + ']');
	let path = string.split('/');
	//console.log(JSON.stringify(path, null, "\t"));
	if(path.length == 1) {
		if(path[0].length > 0) {
			//console.log('Path size 1: ' + path[0]);
			main(path[0]);
		}
	} else if(path.length == 2) {
		if(path[1].length > 0) {
			//console.log('Path size 2: ' + path[0]);
			main(path[0], path[1]);
		} else {
			//console.log('Training Slash!! - call VERSIONS: ' + path[0]);
			let result = await client.getProductVersions(path[0]);
			let table = new xtable({
				data: result.versions
			});
			table.run();
			table.out([
				'id',
				'name',
				'slugUrl',
				'isSelected'
			]);
		}
	} else if(path.length == 3) {
		if(path[2].length > 0) {
			//console.log('Path size 3: ' + path[0]);
			main(path[0], path[1], path[2]);
		} else {
			//console.log('Training Slash!! - call TYPES');
			let data = [
				{id: 'PRODUCT_BINARY'},
				{id: 'DRIVERS_TOOLS'},
	                        {id: 'OPEN_SOURCE'},
				{id: 'CUSTOM_ISO'},
				{id: 'ADDONS'}
			];
			let table = new xtable({data});
			table.run();
			table.out(['id']);
		}
	} else {
		console.log('INVALID PATH');
	}
}

async function cmdGet(fileName) { // broken, fix
	let nstream = new streamer();
	/*{
		md5: (() => {
			md5File.sync('./' + fileName)
		})
	});*/
	client.getDownload(fileName).then(async(file) => {
		console.log(file);
		await nstream.download(file.downloadURL, file.fileName, fs.createWriteStream(fileName));
		if(file.md5checksum == md5Local) {
			console.log('MD5 MATCH: local[ ' + green(md5Local) + ' ] remote [ ' + green(file.md5checksum) + ' ]');
		} else {
                	console.log('MD5 FAIL!: local[ ' + green(md5Local) + ' ] remote [ ' + green(file.md5checksum) + ' ]');
		}
	}).catch((error) => {
		//console.log('[CLI-ERROR]: ' + error.message);
		console.log(error.message);
	});
}

