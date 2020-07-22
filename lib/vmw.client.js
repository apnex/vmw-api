#!/usr/bin/env node
const got = require('got');
const {CookieJar} = require('tough-cookie');

module.exports = class vmwClient {
	constructor(options) {
                this.options = options;
		this.cookieJar = new CookieJar();
		this.base = got.extend({ // client defaults
			cookieJar: this.cookieJar,
			mutableDefaults: true,
			followAllRedirects: true,
			https: {
				rejectUnauthorized: false
			},
			hooks: {
				beforeRedirect: [
					(options, response) => {
						//console.log('[' + options.method + '] ' + options.url.origin + options.url.pathname);
					}
				],
				beforeRequest: [
					(options, response) => {
						console.log('[' + options.method + '] ' + options.url.origin + options.url.pathname);
						//console.log(options.headers);
					}
				]
			}
		});
	}
	async login() {
		// step 1 - Ingest cookies from landing sequence
		await this.base.get('https://my.vmware.com/web/vmware/login');

		// step 2 - Post creds for Auth
		let body = await this.base.post('https://auth.vmware.com/oam/server/auth_cred_submit', {
			searchParams: new URLSearchParams([
				['Auth-AppID', 'WMVMWR']
			]),
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			form: {
				username: this.options.username,
				password: this.options.password
			}
		}).text();

		// strip whitespace and extract SAMLRequest string
		let found = body.replace(/\r?\n|\r/g, "").match(/NAME="SAMLResponse" VALUE="(.+)"/);
		let SAMLResponse;
		if(found[1]) {
			SAMLResponse = found[1];
		}

		// step 3 - send SSO request
		await this.base.post('https://my.vmware.com/vmwauth/saml/SSO', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			form: { SAMLResponse }
		});

		// step 4 - get XSRF-TOKEN token and set in client header
		// consider moving step 3 + 4 to a GOT hook to maintain session
		this.cookieJar.getCookies('https://my.vmware.com', (err, cookies) => {
			this.client = this.base.extend({ // update default client options
				prefixUrl: 'https://my.vmware.com/',
				headers: {
					'X-XSRF-TOKEN': cookies.filter((cookie) => {
						return (cookie.key == 'XSRF-TOKEN');
					})[0].value
				}
			});
		});

		// other links
		//https://my.vmware.com/web/vmware/checksession
		//https://my.vmware.com/vmwauth/loggedinuser
		//https://my.vmware.com/channel/api/v1.0/evals/active
		//https://my.vmware.com/channel/api/v1.0/sdp/services
	}
	async accountInfo() {
		return this.client.post('channel/api/v1.0/ems/accountinfo', {
			headers: {
				'Accept': 'application/json, text/plain, */*'
			},
			json: {
				"rowLimit": "3"
			}
		}).json();
	}
	//https://my.vmware.com/group/vmware/extend_session
	async getProducts() {
		return this.client.get('channel/public/api/v1.0/products/getProductsAtoZ', {
			searchParams: new URLSearchParams([
				['isPrivate', 'true'],
			])
		}).json();
	}
	async getProductHeader() {
		return this.client.get('channel/public/api/v1.0/products/getProductHeader', {
			searchParams: new URLSearchParams([
				['category', 'networking_security'],
				['product', 'vmware_nsx_t_data_center'],
				['version', '3_x']
			])
		}).json();
	}
	async getRelatedDLGList() {
		return this.client.get('channel/public/api/v1.0/products/getRelatedDLGList', {
			searchParams: new URLSearchParams([
				['category', 'networking_security'],
				['product', 'vmware_nsx_t_data_center'],
				['version', '3_x'],
				['dlgType', 'PRODUCT_BINARY']
			])
		}).json();
	}
	async getDLGHeader() {
		return this.client.get('channel/public/api/v1.0/products/getDLGHeader', {
			searchParams: new URLSearchParams([
				['downloadGroup', 'NSX-T-30110'],
				['productId', 982]
			])
		}).json();
	}
	async getDLGDetails() {
		return this.client.get('channel/api/v1.0/dlg/details', {
			searchParams: new URLSearchParams([
				['downloadGroup', 'NSX-T-30110'],
				['productId', 982]
			])
		}).json();
	}
	async getMyLicensedProducts() {
		return this.client.post('channel/api/v1.0/products/getMyLicensedProducts');
	}
	async eulaAccept() {
		return this.client.get('channel/api/v1.0/dlg/eula/accept', {
			searchParams: new URLSearchParams([
				['downloadGroup', 'NSX-T-30110'],
				['productId', 982]
			])
		}).json();
	}
	async getDownload() {
		return this.client.post('channel/api/v1.0/dlg/download', {
			json: {
				"locale": "en_US",
				"downloadGroup": "NSX-T-301",
				"productId": "982",
				"md5checksum": "bdb122fcde1bbc8ba2f8575929feb247",
				"tagId": 12097,
				"uUId": "031fa4f7-3b82-441d-a5f7-8de1b42d597b",
				"dlgType": "Product Binaries",
				"productFamily":"VMware NSX-T Data Center",
				"releaseDate":"2020-06-23",
				"dlgVersion": "3.0.1",
				"isBetaFlow": false
			}
		}).json();
	}
}
