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

const debug = require('debug')('autoconfig:folio:add-permission');
const Q = require('q');
const progress = require('cli-progress');

exports.command = 'add-permission';
exports.desc = 'add permission to user';
exports.builder = (yargs) => {
	return yargs.options({
		'tenant-id': {
			alias: 'id',
			desc: 'the tenants id',
			default: process.env.TENANT_ID || 'diku'
		},
		'user-name': {
			desc: 'the username of the administrative user',
			default: process.env.ADMIN_USERNAME || 'admin'
		},
		'user-password': {
			desc: 'the password for the administrative user',
			default: process.env.ADMIN_PASSWORD || 'adminpw'
		},
		'perms': {
			desc: 'the permissions to set to the user',
			default: ['perms.all'],
			array: true
		},
		'all': {
			desc: 'add all available permissions',
			default: false,
			boolean: true
		}
	});
};

exports.handler = (argv) => {
	const progressBar = new progress.Bar( {}, progress.Presets.shades_classic);
	progressBar.start(5, 0);
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		registryUrl: argv.registryUrl,
		okapiTryCount: 3,
		enableModuleTryCount: 3,
		disableModuleTryCount: 3,
		introduceModuleTryCount: 3,
		waitForModuleTryCount: 3,
		progressBar: progressBar
	});

	debug(argv);
	progressBar.increment(null, {msg: 'Waiting for Okapi'});
	return okapitools.waitForOkapi().then(() => {
	progressBar.increment(null, {msg: 'Logging in'});
	return okapitools.login(argv.tenantId, argv.userName, argv.userPassword);
	}).then(session => {
		progressBar.increment(null, {msg: 'Getting permissions'});
		const promise = argv.all ? okapitools.getPermissions(argv.tenantId, session.token).then(permissions => {
			return Q.all(permissions.filter(item => {
				return session.permissions.permissions.indexOf(item.permissionName) === -1;
			})).map(item => item.permision.permissionName);
		}) : Q.resolve(argv.perms);
		return promise.then(permissions => {
			progressBar.setTotal(progressBar.total + permissions.length);
			return permissions.reduce((p, permission) => {
				return p.then(() => {
					progressBar.increment(null, {msg: `assigning permissions ${permission}`});
					return okapitools.assignPermission(argv.tenantId, session.token, session.permissions.id, permission);
				});
			}, Q.resolve());
		});
	}).then(() => {
		progressBar.stop();
	}).catch(err => {
		progressBar.stop();
		console.error(err);
	});
};