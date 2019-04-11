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
		listModules: listModules
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
						deferred.reject(err);
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
			return introduceModule(path.join(dir, file));
		}));
	} catch (err) {
		return Q.reject(err);
	}
}


function listModules() {
	const uri = options.moduleId ? `${options.okapiUrl}/_/proxy/modules/${options.moduleId}` : `${options.okapiUrl}/_/proxy/modules`;
	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: uri,
	}).then(res => {
		debug(res);
		return deferred.resolve(true);
	}).catch((err) => {
		debug(err);
		return deferred.resolve(false);
	});

	return deferred.promise;
}

function introduceModule(file) {
	try {
		debug(file);
		return parseFile(file).then(parsed => {
			return isModuleAlreadyIntroduced(parsed.id).then(isAlreadyIntroduced => {
				return (isAlreadyIntroduced) ? forgetModule(parsed.id) : Q.resolve();
			}).then(() => {
				return postModuleDescriptor(JSON.stringify(parsed));
			});
		});
	} catch (err) {
		return Q.reject(err);
	}
}

function parseFile(file) {
	const deferred = Q.defer();

	if (file === '-') {
		let data = '';
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false
		});

		rl.on('line', (line) => {
			data += line;
		});

		rl.on('close', (res) => {
			try {
				const parsed = JSON.parse(data);
				debug(parsed);
				deferred.resolve(parsed);
			} catch (err) {
				deferred.reject(err);
			}
		});
	} else {
		fs.readFile(file, (err, data) => {
			if (err) return deferred.reject(err);
			try {
				const parsed = JSON.parse(data);
				debug(parsed);
				deferred.resolve(parsed);
			} catch (err) {
				deferred.reject(err);
			}
		});
	}
	return deferred.promise;
}

function isModuleAlreadyIntroduced(id) {
	const deferred = Q.defer();
	request({
		method: 'GET',
		uri: options.okapiUrl + '/_/proxy/modules/' + id,
	}).then(res => {
		debug(res);
		return deferred.resolve(true);
	}).catch((err) => {
		debug(err);
		return deferred.resolve(false);
	});

	return deferred.promise;
}

function forgetModule(id) {
	const deferred = Q.defer();
	request({
		method: 'DELETE',
		uri: options.okapiUrl + '/_/proxy/modules/' + id,
	}).then(res => {
		debug(res);
		deferred.resolve(res);
	}).catch(err => {
		debug(err);
		deferred.reject(err);
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
				body: payload
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				debug(err);
				setTimeout(() => {
					deferred.reject(err);
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
	} catch(err) {
		return Q.reject(err);
	}
}

function waitForBackendModule(module) {
	console.log(`Waiting for backend-module "${module}"`);
	return [...Array(options.waitForModuleTryCount).keys()].reduce(promise => {
		const deferred = Q.defer();

		promise.then(deferred.resolve).catch(err => {
			request({
				method: 'GET',
				uri: `${options.okapiUrl}/_/proxy/modules/${module}`,
			}).then(res => {
				deferred.resolve(res);
			}).catch(err => {
				debug(err);
				setTimeout(() => {
					deferred.reject(err);
				}, 1000);
			});
		});
		return deferred.promise;
	}, Q.reject());
}