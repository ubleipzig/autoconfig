/**
	autoconfig

	Copyright (C) 2019 Leipzig University Library <info@ub.uni-leipzig.de>

	Author: Ulf Seltmann <ulf.seltmann@uni-leipzig.de>
	License: GNU GPLv3 <https://spdx.org/licenses/GPL-3.0-or-later.html>

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

require('any-promise/register/q');

const Q = require('q');
const request = require('request-promise-any');
const fs = require('fs');
const path = require('path');
const debug = require('debug')('autoconfig:folio:okapitools');
const readline = require('readline');
const logUpdate = require('log-update');
const rr = require('recursive-readdir');

var fsOptions = {
	encoding: 'utf8',
	mode: '0644'
};

var options;

module.exports = function (o) {
	options = o;

	return {
		waitForOkapi: waitForOkapi,
		introduceModules: introduceModules,
		introduceModule: introduceModule,
		listModule: listModule,
		registerFrontendModules: registerFrontendModules,
		tenantExists: tenantExists,
		createTenant: createTenant,
		waitForBackendModules: waitForBackendModules,
		enableModules: enableModules,
		disableModules: disableModules,
		findModuleIdByInterface: findModuleIdByInterface,
		createUser: createUser,
		userExists: userExists,
		deleteUser: deleteUser,
		createUserCredentials: createUserCredentials,
		userCredentialsExist: userCredentialsExist,
		deleteUserCredentials: deleteUserCredentials,
		createUserPermissions: createUserPermissions,
		userPermissionsExist: userPermissionsExist,
		deleteUserPermissions: deleteUserPermissions,
		login: login,
		getPermissions: getPermissions,
		assignPermission: assignPermission,
		loadData: loadData
	};
};

/**
 * tries options.okapiTryCount times to reach okapi
 *
 * @returns Promise
 */
function waitForOkapi() {
	return [...Array(options.okapiTryCount).keys()].reduce(first => {
		const deferred = Q.defer();

		first.then(deferred.resolve).catch(err => {
			request(options.okapiUrl + '/_/proxy/modules')
				.then(deferred.resolve)
				.catch(err => {
					setTimeout(() => {
						deferred.reject(err.message);
					}, 1000);
				});
		});
		return deferred.promise;
	}, Q.reject());
}

function introduceModules(dir) {
	try {
		const moduleDescriptors = fs.readdirSync(dir);
		return Q.all(moduleDescriptors.map(file => {
			return moduleExists(parsed.id).then(isAlreadyIntroduced => {
				return (isAlreadyIntroduced) ? forgetModule(parsed.id) : Q.resolve();
			}).then(() => {
				return introduceModule(path.join(dir, file));
			});
		}));
	} catch (err) {
		return Q.reject(err);
	}
}


function listModule(moduleId) {
	const uri = moduleId ? `${options.okapiUrl}/_/proxy/modules/${moduleId}` : `${options.okapiUrl}/_/proxy/modules`;
	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: uri,
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(res);
		return deferred.resolve(true);
	}).catch((err) => {
		debug(err.message);
		return deferred.resolve(false);
	});

	return deferred.promise;
}

function introduceModule(file) {
	try {
		debug(file);
		return parseFile(file).then(parsed => {
			return postModuleDescriptor(JSON.stringify(parsed));
		});
	} catch (err) {
		return Q.reject(err);
	}
}

function parseFile(file) {
	return readContent(file).then(data => {
		try {
			return Q.resolve(JSON.parse(data));
		} catch(err) {
			return Q.reject(err);
		}
	});
}
function readContent(source) {
	const deferred = Q.defer();

	if (source === '-') {
		let data = '';
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false
		});

		rl.on('line', (line) => data += line);
		rl.on('close', () => deferred.resolve(data));
		rl.on('error', deferred.reject);
	} else {
		fs.readFile(source, (err, data) => {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
	}
	return deferred.promise;
}

function moduleExists(id) {
	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: options.okapiUrl + '/_/proxy/modules/' + id,
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(res);
		return deferred.resolve(true);
	}).catch((err) => {
		debug(err.message);
		return deferred.resolve(false);
	});

	return deferred.promise;
}

function forgetModule(id) {
	const deferred = Q.defer();
	request({
		method: 'DELETE',
		uri: options.okapiUrl + '/_/proxy/modules/' + id,
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(res);
		deferred.resolve(res);
	}).catch(err => {
		debug(err.message);
		deferred.reject(err.message);
	});

	return deferred.promise;
}

/**
 * posts moduleDescriptor to okapi
 *
 * @param {Object} payload
 * @returns Promise
 */
function postModuleDescriptor(payload) {
	return [...Array(options.introduceModuleTryCount).keys()].reduce(promise => {

		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: options.okapiUrl + '/_/proxy/modules',
				body: payload,
				headers: {
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				debug(err.message);
				setTimeout(() => {
					deferred.reject(err.message);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function waitForBackendModules(moduleList) {
	try {
		return Q.all(moduleList.map(module => {
			return waitForBackendModule(module);
		}));
	} catch (err) {
		return Q.reject(err);
	}
}

function waitForBackendModule(module) {
	options.progressBar.increment(null, {msg: `Waiting for backend-module "${module}"`});
	return [...Array(options.waitForModuleTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'GET',
				uri: `${options.okapiUrl}/_/proxy/modules/${module}`,
				headers: {
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				debug(err.message);
				setTimeout(() => {
					deferred.reject(err.message);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function registerFrontendModules(moduleList) {
	return Q.all(moduleList.map(moduleId => {
		return moduleExists(moduleId).then(isAlreadyIntroduced => {
			return isAlreadyIntroduced ? Q.resolve() : fetchModuleDescriptor(moduleId).then(moduleDescriptor => {
				return postModuleDescriptor(moduleDescriptor);
			});
		});
	}));

	function fetchModuleDescriptor(moduleId) {
		const deferred = Q.defer();
		request({
			method: 'GET',
			uri: `${options.registryUrl}/_/proxy/modules/${moduleId}`,
			headers: {
				'Content-type': 'application/json',
				'Accept': 'application/json'
			}
		}).then(deferred.resolve).catch(err => {
			debug(err.message);
			deferred.reject(err.message);
		});

		return deferred.promise;
	}
}

function tenantExists(id) {
	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: options.okapiUrl + '/_/proxy/tenants/' + id,
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(res);
		return deferred.resolve(true);
	}).catch((err) => {
		debug(err.message);
		return deferred.resolve(false);
	});

	return deferred.promise;
}

function createTenant(payload) {
	const deferred = Q.defer();

	request({
		method: 'POST',
		uri: options.okapiUrl + '/_/proxy/tenants',
		body: JSON.stringify(payload),
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(deferred.resolve).catch(err => {
		deferred.reject(`createTenant: ${err.message}`);
	});

	return deferred.promise;
}

function enableModules(tenantId, moduleList) {
	options.progressBar.increment(null, {msg: `Enabling modules for tenant "${tenantId}"`});

	const payload = JSON.stringify(moduleList.map(moduleId => {
		return {
			id: moduleId,
			action: 'enable'
		};
	}));
	return [...Array(options.enableModuleTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/_/proxy/tenants/${tenantId}/install`,
				body: payload,
				headers: {
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(JSON.parse(res));
			}).catch(err => {
				debug(err.message);
				setTimeout(() => {
					deferred.reject(err.message);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function findModuleIdByInterface(tenantId, iface) {
	const deferred = Q.defer();

	request({
		method: 'GET',
		uri: `${options.okapiUrl}/_/proxy/tenants/${tenantId}/interfaces/${iface}`,
		headers: {
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(res);
		try {
			const data = JSON.parse(res);
			if (data.length === 0) return Q.reject(`no module found for interface ${iface}`);
			if (data.length > 1) {
				return Q.reject(`ambiguous interface ${iface}`);
			}

			deferred.resolve(data[0].id);
		} catch (err) {
			deferred.reject(err);
		}

		return deferred.promise;
	}).catch(deferred.reject);

	return deferred.promise;
}

function disableModules(tenantId, moduleList) {
	options.progressBar.increment(null, {msg: `Disabling modules for tenant "${tenantId}"`});

	const payload = JSON.stringify(moduleList.map(moduleId => {
		return {
			id: moduleId,
			action: 'disable'
		};
	}));

	return [...Array(options.disableModuleTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/_/proxy/tenants/${tenantId}/install`,
				body: payload,
				headers: {
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(JSON.parse(res));
			}).catch(err => {
				debug(err.message);
				setTimeout(() => {
					deferred.reject(err.message);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function createUser(tenantId, user) {
	options.progressBar.increment(null, {msg: `Creating user ${user.username} with id ${user.id}`});

	const payload = JSON.stringify(user);

	return [...Array(options.createUserTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/users`,
				body: payload,
				headers: {
					'X-Okapi-Tenant': tenantId,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(JSON.parse(res));
			}).catch(err => {
				setTimeout(() => {
					deferred.reject(`createUser: ${err.message}`);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function userExists(tenantId, userId, token) {
	options.progressBar.increment(null, {msg: `Checking whether user exists with id ${userId}`});
	const deferred = Q.defer();

	request({
		method: 'GET',
		uri: `${options.okapiUrl}/users/${userId}`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'X-Okapi-Token': token,
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(`userExists: ${res}`);
		deferred.resolve(true);
	}).catch(err => {
		debug(`userExists: ${err.message}`);
		deferred.resolve(false);
	});

	return deferred.promise;
}

function deleteUser(tenantId, userId) {
	options.progressBar.increment(null, {msg: `Removing existing user with id ${userId}`});
	return request({
		method: 'DELETE',
		uri: `${options.okapiUrl}/users/${userId}`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'text/plain'
		}
	});
}

function createUserCredentials(tenantId, user, password) {
	options.progressBar.increment(null, {msg: 'Creating credentials for user ' + user.username});

	const payload = JSON.stringify({
		userId: user.id,
		password: password
	});

	return [...Array(options.createUserCredentialsTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/authn/credentials`,
				body: payload,
				headers: {
					'X-Okapi-Tenant': tenantId,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				setTimeout(() => {
					deferred.reject(`createUserCredentials: ${err.message}`);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function userCredentialsExist(tenantId, userId) {
	options.progressBar.increment(null, {msg: `Checking whether credentials exist for user ${userId}`});

	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: `${options.okapiUrl}/authn/credentials?query=userId==${userId}`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(`userCredentialsExist: ${res}`);
		const data = JSON.parse(res);
		if (!data.credentials || data.credentials.length !== 1) return deferred.resolve(null);
		deferred.resolve(data.credentials[0].id);
	}).catch(err => {
		debug(`userCredentialsExist: ${err.message}`);
		deferred.resolve(false);
	});

	return deferred.promise;
}

function deleteUserCredentials(tenantId, id) {
	options.progressBar.increment(null, {msg: `Deleting credentials ${id}`});

	return request({
		method: 'DELETE',
		uri: `${options.okapiUrl}/authn/credentials/${id}`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'text/plain'
		}
	});
}
function createUserPermissions(tenantId, user, perms) {
	options.progressBar.increment(null, {msg: 'Creating permission for user ' + user.username});

	const payload = JSON.stringify({
		userId: user.id,
		permissions: perms
	});

	return [...Array(options.createUserCredentialsTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/perms/users`,
				body: payload,
				headers: {
					'X-Okapi-Tenant': tenantId,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				debug(`createUserPermissions: ${err.message}`);
				setTimeout(() => {
					deferred.reject(`createUserPermissions: ${err.message}`);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function userPermissionsExist(tenantId, userId) {
	options.progressBar.increment(null, {msg: `Checking whether permissions exist for user ${userId}`});

	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: `${options.okapiUrl}/perms/users/${userId}?indexField=userId`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(`userPermissionsExist: ${res}`);
		const data = JSON.parse(res);
		deferred.resolve(data.id);
	}).catch(err => {
		debug(`userPermissionsExist: ${err.message}`);
		deferred.resolve(null);
	});

	return deferred.promise;
}

function deleteUserPermissions(tenantId, id) {
	options.progressBar.increment(null, {msg: `Removing permissions with id ${id}`});
	return request({
		method: 'DELETE',
		uri: `${options.okapiUrl}/perms/users/${id}`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'text/plain'
		}
	});
}

function userPermissionExist(tenantId, userId, permission) {
	options.progressBar.increment(null, {msg: `Checking whether permission ${permission} exists for user ${userId}`});

	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: `${options.okapiUrl}/perms/users/${userId}?indexField=userId`,
		headers: {
			'X-Okapi-Tenant': tenantId,
			'Content-type': 'application/json',
			'Accept': 'application/json'
		}
	}).then(res => {
		debug(`userPermissionsExist: ${res}`);
		const data = JSON.parse(res);
		deferred.resolve(data.id);
	}).catch(err => {
		debug(`userPermissionsExist: ${err.message}`);
		deferred.resolve(null);
	});

	return deferred.promise;
}

function login(tenantId, name, password) {
	options.progressBar.increment(null, {msg: `Logging in user ${name}`});

	const payload = JSON.stringify({
		username: name,
		password: password
	});

	return [...Array(options.loginTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/bl-users/login`,
				body: payload,
				headers: {
					'X-Okapi-Tenant': tenantId,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				},
				resolveWithFullResponse: true
			}).then(res => {
				const body = JSON.parse(res.body);
				debug(`login: ${res.body}`);
				deferred.resolve({
					token: res.headers['x-okapi-token'],
					user: body.user,
					permissions: body.permissions
				});
			}).catch(err => {
				debug(err.message);
				setTimeout(() => {
					deferred.reject(err.message);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function getPermissions(tenantId, token) {
	options.progressBar.increment(null, {msg: `Getting permissions for tenant ${tenantId}`});

	return [...Array(options.loginTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'GET',
				uri: `${options.okapiUrl}/perms/permissions?query=childOf%3D%3D%5B%5D&length=99999`,
				headers: {
					'X-Okapi-Tenant': tenantId,
					'X-Okapi-Token': token,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				debug(`getPermissions: ${res}`);
				deferred.resolve(JSON.parse(res).permissions);
			}).catch(err => {
				setTimeout(() => {
					deferred.reject(`getPermissions: ${err.message}`);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function assignPermission(tenantId, token, id, permission) {
	options.progressBar.increment(null, {msg: `Assigning permission ${permission}`});

	return [...Array(options.loginTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'POST',
				uri: `${options.okapiUrl}/perms/users/${id}/permissions`,
				body: JSON.stringify({ permissionName: permission }),
				headers: {
					'X-Okapi-Tenant': tenantId,
					'X-Okapi-Token': token,
					'Content-type': 'application/json',
					'Accept': 'application/json'
				}
			}).then(res => {
				debug(`assignPermissions: ${res}`);
				deferred.resolve(res);
			}).catch(err => {
				setTimeout(() => {
					deferred.reject(`assignPermissions: ${err.message}`);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}

function loadData(tenantId, token, dir, sort, customMethod) {
	return rr(dir, ['*.xml']).then(files => {
		return customMethod.map(item => {
			let pattern, method;
			[pattern, method] = item.split('=');
			const regex = new RegExp(`^${dir}/${pattern}`);
			return files.filter(file => file.match(regex)).map(file2 => {
				return {
					file: file2,
					method: method || 'POST'
				};
			});
		}).reduce((acc, val) => {
			return acc.concat(val);
		}, []).reduce((acc, val) => {
			const index = acc.indexOf(val.file);
			if (index !== -1) {
				acc.push(val);
				acc.splice(index, 1);
			}
			return acc;
		}, files).filter(item => typeof item === 'object').sort((a, b) => a.file.localeCompare(b.file));
	}).then(files => {
		return sort.map(pattern => {
			const regex = new RegExp(`^${dir}/${pattern}`);
			return files.filter(file => file.file.match(regex));
		}).reduce((acc, val) => acc.concat(val), []).reduce((acc, val) => {
			const index = acc.indexOf(val.file);
			if (index !== -1) {
				acc.push(val);
				acc.splice(index, 1);
			}
			return acc;
		}, files.map(item => item.file));
	}).then(files => {
		return files.reduce((promise, item) => {
			return promise.then(() => {
				return parseFile(item.file);
			}).then(data => {
				const endpoint = path.dirname(item.file.replace(new RegExp(`^${dir}/?`), ''));
				debug(`load-data: ${item.method} ${endpoint}`);
				return request({
					method: item.method,
					uri: `${options.okapiUrl}/${endpoint}`,
					body: JSON.stringify(data),
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json, text/plain',
						'X-Okapi-Tenant': tenantId,
						'X-Okapi-Token': token
					},
					simple: false,
					resolveWithFullResponse: true
				}).then(res => {
					let message;
					try {
						if (res.statusCode >= 400) {
							message = JSON.parse(res.body).errors[0].message;
						} else {
							message = res.statusCode;
						}
					} catch(err) {
						message = res.body;
					}

					options.progressBar.increment(null, {msg: `load-data: ${item.file} ... ${res.statusCode}: ${message}`});
				});
			});
		}, Q.resolve());
	});
}
