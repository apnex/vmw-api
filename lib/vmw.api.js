#!/usr/bin/env node
'use strict';
const vmwClient = require('./vmw.sdk');
const streamer = require('./streamer');
const fs = require('fs');
const CookieFileStore = require('tough-cookie-file-store').FileCookieStore;
const {CookieJar} = require('tough-cookie');

// provides a higher order interface on top of vmw.sdk.js
// handles auth/session persistence
// handles FS/IO operations
// deals in input/output JSON data, does not render to screen - delegates to cli
// handles file download operations
// handles MD5 checks

// ignore self-signed certificate
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// colours
const chalk = require('chalk');
const red = chalk.bold.red;
const orange = chalk.keyword('orange');
const green = chalk.green;
const blue = chalk.blueBright;

module.exports = class vmwApi {
	constructor(options = {}) {
		this.client = new vmwClient({
			cookieJar: new CookieJar(new CookieFileStore('./cookies.json'))
		});
		this.username = options.username;
		this.password = options.password;
	}
	async main(category, version, type) {
		try {
			// test account info
			let account = await this.tryAuth();

			// build product cache
			let result = await this.getRelatedDLGList(category, version, type);
			let fetchEntries = Object.entries(this.buildFileList(result));

			// map remaining entries to parallel call array
			// consider rate limited queue for calls - p-queue?
			let fetchList = fetchEntries.map((item) => {
				return this.fetchFiles({
					downloadGroup: item[0],
					productId: Object.keys(item[1].productId)[0]
				});
			});

			// Resolve all outstanding web calls, flatten arrays and return result
			return await Promise.all(fetchList).then((result) => {
				let data = result.flat(1)
				fs.writeFileSync('./fileList.json', JSON.stringify(data, null, "\t"), 'utf8');
				return data;
			});
		} catch(error) {
			throw new Error(error.message);
		}
	}
	async tryAuth() {
		try {
			if(fs.existsSync('./headers.json')) {
				let headers = require('./headers.json');
				this.client.client = this.client.base.extend({
					prefixUrl: 'https://my.vmware.com/',
					headers
				});
			} else {
				this.client.client = this.client.base.extend({
					prefixUrl: 'https://my.vmware.com/'
				});
			}
			return await this.client.accountInfo();
		} catch(error) {
			//console.log(error);
			if(error.code == 401) {
		                // login
				console.log('[INFO]: 401 Clearing stale sessions');
				let headers = await this.client.login({
					username: this.username,
					password: this.password
				});
				fs.writeFileSync('./headers.json', JSON.stringify(headers, null, "\t"), 'utf8');
				// retry
				console.log('Re-authentication completed, trying call again...');
				return await this.client.accountInfo();
			}
		}
	}
	async fetchFiles(body) {
		// get product header
	 	let fileHeader = await this.client.getDLGHeader(body);

		// check download eligibility
		let fileDetails = await this.client.getDLGDetails(body);
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
	buildFileList(result) { // make async?
		// BUILD code->[productId] map
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
	async getProductVersions(productName) {
		let products = await this.getProducts();
		let product = products.filter((item) => {
 	      	 	return (item.product == productName);
		})[0];
		return this.client.getProductHeader({
			category: product.category,
			product: product.product,
			version: product.version
		});
	}
	async getRelatedDLGList(productName, productVersion, productType) {
		//console.log('PRODUCTS: ' + productName);
		let products = await this.getProducts();
		let product = products.filter((item) => {
			return (item.product == productName);
		})[0];
		//console.log('HARTY');

		if(typeof(product) != 'undefined') {
			if(typeof(productVersion) == 'undefined') {
				productVersion = product.version;
			}
			if(typeof(productType) == 'undefined') {
				productType = product.dlgType;
			}
			let params = {
				category: product.category,
				product: product.product,
				version: productVersion,
				dlgType: productType
			};
			//console.log(JSON.stringify(params, null, "\t"));
			return this.client.getRelatedDLGList(params);
		} else {
			throw new Error('Invalid category selected - no match[' + productName + ']');
		}
	}
	async getProducts() {
		let result = [];
		return this.client.getProducts().then((products) => {
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
	async getDownload(fileName) {
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
			return this.client.getDownload(json);
		} else {
			throw new Error('[' + red('ERROR') + ']: Not permitted to download this file, check account entitlement');
		}
	}
}
