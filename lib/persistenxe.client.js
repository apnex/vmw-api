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
			/*https: {
				rejectUnauthorized: false
			},*/
			hooks: {
				afterResponse: [
					async (response, retryWithMergedOptions) => {
						if (response.statusCode === 401) { // Unauthorized - re-attempt login after bad token
							// Build updated options
							// get token from disk?
							console.log('ERROR: Bad or missing token, attempting re-auth...');
							let updatedOptions = await this.login();
							return retryWithMergedOptions(updatedOptions);
						} else {
							return response;
						}
					}
				],
				beforeRedirect: [
					(options, response) => { // throw Error if credentials fail
						if(new RegExp('errorCode=AUTH-ERR', 'g').exec(response.redirectUrls[0])) {
							throw new Error('[ERROR]: AUTH-ERROR please check environment variables $VMWUSER and $VMWPASS are correct and try again!');
						}
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
		this.client = this.base.extend({ // update default client options
			prefixUrl: 'https://my.vmware.com/'
		});
	}
	async login() {
		// Obtain token and save as X-XSRF-TOKEN header in client defaults
		let updatedOptions = {
			headers: {
				'X-XSRF-TOKEN': await this.getNewToken(this.options.username, this.options.password) // Refresh token
			}
		};
		this.base.defaults.options = got.mergeOptions(this.base.defaults.options, updatedOptions);
		this.client.defaults.options = got.mergeOptions(this.client.defaults.options, updatedOptions);
		// save token//headers to disk? or is persistence handled in vmw-api?
		return updatedOptions;
	}
	async getNewToken(username, password) {
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
			form: { username, password }
		}).text();

		// strip whitespace and extract SAMLRequest string
		let found = body.replace(/\r?\n|\r/g, "").match(/NAME="SAMLResponse" VALUE="(.+)"/);
		let SAMLResponse;
		if(found[1]) {
			SAMLResponse = found[1];
		}

		// step 3 - post SSO request
		await this.base.post('https://my.vmware.com/vmwauth/saml/SSO', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			form: { SAMLResponse }
		});

		// step 4 - return XSRF-TOKEN token
		return this.cookieJar.getCookies('https://my.vmware.com', (err, cookies) => {
			return cookies.filter((cookie) => {
				return (cookie.key == 'XSRF-TOKEN');
			})[0].value;
		});
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
		let params = {
			'isPrivate': 'true'
		}
		return this.base.get('channel/public/api/v1.0/products/getProductsAtoZ', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async getProductHeader(params) {
		return this.client.get('channel/public/api/v1.0/products/getProductHeader', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async getRelatedDLGList(params) {
		return this.client.get('channel/public/api/v1.0/products/getRelatedDLGList', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async getDLGHeader(params) {
		return this.client.get('channel/public/api/v1.0/products/getDLGHeader', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async getDLGDetails(params) {
		return this.client.get('channel/api/v1.0/dlg/details', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async eulaAccept(params) {
		return this.client.get('channel/api/v1.0/dlg/eula/accept', {
			searchParams: new URLSearchParams(Object.entries(params))
		}).json();
	}
	async getMyLicensedProducts() {
		return this.client.post('channel/api/v1.0/products/getMyLicensedProducts');
	}
	async getDownload(json) {
		return this.client.post('channel/api/v1.0/dlg/download', {json}).json();
	}
}
