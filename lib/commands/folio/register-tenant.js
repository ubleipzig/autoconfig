#!/usr/bin/env node

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

const path = require('path');
const debug = require('debug')('autoconfig:folio:register-tenant');
const Q = require('q');

exports.command = 'register-tenant';
exports.desc = 'convenient method to register a new tenant, enable its modules, create an admin user and load reference data';
exports.builder = (yargs) => {
	return yargs.options({
		'install-backend-modules': {
			desc: 'the backend-modules to install. repeat for multiple modules'
		},
		'install-frontend-modules': {
			desc: 'the frontend-modules to install. repeat for multiple modules'
		},
		id: {
			desc: 'the tenants id',
			default: 'diku'
		},
		name: {
			desc: 'the tenants name'
		},
		description: {
			desc: 'the tenants description'
		},
		'reference-data-dir': {
			desc: 'the path to the directory holding the reference-data to load'
		},
		'sample-data-dir': {
			desc: 'the path to the directory holding the sample-data to load'
		}
	});
};

exports.handler = (argv) => {
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		okapiTryCount: 3
	});

	okapitools.waitForOkapi().then(() => {
		return okapitools.registerFrontendModules(argv.installFrontendModules);
	}).then(() => {
		const deferred = Q.defer();
		okapitools.tenantExists().then(res => {
			debug(res);
			deferred.resolve();
		}).catch(err => {
			debug(err);
			okapitools.createTenant({
				id: argv.id,
				description: argv.description,
				name: argv.name
			}).then(deferred.resolve).catch(deferred.reject);
		});
	}).then(res => {
		return okapitools.waitForBackendModules(argv.installBackendModules);
	}).then(res => {
		return okapitools.installModules(argv.id, [...argv.installBackendModules, ...argv.installFrontendModules]);
	}).then(res => {
		return okapitools.findModule(argv.id, 'authtoken');
	}).then(res => {
		return okapitools.disableModule(argv.id, res);
	}).then(res => {
		return okapitools.createAdmin(argv.id).then(user => {
			return okapitools.createAdminCredentials(user);
		}).then(() => {
			return okapitools.createAdminPermission(user, 'perms.all');
		}).then(() => {
			return okapitools.enableModule(argv.id, res);
		});
	}).then(res => {
		return okapitools.login();
	}).then(res => {
		return okapitools.getPermissions(res).then(permissions => {
			return okapitools.assignPermissions(res, permissions);
		}).then(() => {
			return okapitools.loadReferenceData(argv.id, res, argv.referenceDataDir);
		}).then(() => {
			return okapitools.loadSampleData(argv.id, res, argv.sampleDataDir);
		});
	}).then(res => {
		return okapitools.assignPermissions(res);
	}).then('done' + console.log)
		.catch(console.error);
}