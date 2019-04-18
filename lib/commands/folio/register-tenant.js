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
const createUser = require('./create-user');
const addPermission = require('./add-permission');

exports.command = 'register-tenant';
exports.desc = 'convenient method to register a new tenant, enable its modules, create an admin user and load reference data';
exports.builder = (yargs) => {
	return yargs.options({
		'install-backend-modules': {
			desc: 'the backend-modules to install. repeat for multiple modules',
			array: true
		},
		'install-frontend-modules': {
			desc: 'the frontend-modules to install. repeat for multiple modules',
			array: true
		},
		'tenant-id': {
			alias: 'id',
			desc: 'the tenants id',
			default: process.env.TENANT_ID || 'diku'
		},
		name: {
			desc: 'the tenants name',
			default: process.env.TENANT_NAME || 'diku'
		},
		description: {
			desc: 'the tenants description'
		},
		'reference-data-dir': {
			desc: 'the path to the directory holding the reference-data to load'
		},
		'sample-data-dir': {
			desc: 'the path to the directory holding the sample-data to load'
		},
		'user-id': {
			desc: 'the username of the administrative user',
			default: process.env.ADMIN_ID || '99999999-9999-9999-9999-999999999999'
		},
		'user-name': {
			desc: 'the username of the administrative user',
			default: process.env.ADMIN_USERNAME || 'admin'
		},
		'user-password': {
			desc: 'the password for the administrative user',
			default: process.env.ADMIN_PASSWORD || 'adminpw'
		},
		'all': {
			desc: 'add all available permissions to the user',
			default: true,
			boolean: true
		},
		'recreate-user': {
			desc: 'recreate admin-user if already exists',
			boolean: true
		}
	});
};

exports.handler = (argv) => {
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		registryUrl: argv.registryUrl,
		okapiTryCount: 3,
		enableModuleTryCount: 3,
		disableModuleTryCount: 3,
		introduceModuleTryCount: 3,
		waitForModuleTryCount: 3
	});

	debug(argv);
	return okapitools.waitForOkapi().then(() => {
		return okapitools.registerFrontendModules(argv.installFrontendModules);
	}).then(() => {
		const deferred = Q.defer();
		return okapitools.tenantExists(argv.tenantId).then(tenantAlreadyExists => {
			debug(tenantAlreadyExists);
			return tenantAlreadyExists ? deferred.resolve() : okapitools.createTenant({
				id: argv.tenantId,
				description: argv.description,
				name: argv.name
			});
		});
	}).then(res => {
		return okapitools.waitForBackendModules(argv.installBackendModules || []);
	}).then(res => {
		return okapitools.enableModules(argv.tenantId, [... (argv.installBackendModules || []), ... (argv.installFrontendModules || [])]);
	}).then(res => {
		return okapitools.findModuleIdByInterface(argv.tenantId, 'authtoken');
	}).then(moduleId => {
		return okapitools.disableModules(argv.tenantId, [moduleId]);
	}).then(modules => {
		argv.userPermissions = ['perms.all'];
		return createUser.handler(argv).then(res => {
			return okapitools.enableModules(argv.tenantId, modules.map(item => item.id));
		});
	}).then(() => {
		return addPermission.handler(argv);
	}).then('done' + console.log).catch(console.error);
};