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
const debug = require('debug')('autoconfig:folio:create-user');
const Q = require('q');
const removeUser = require('./remove-user');

exports.command = 'create-user';
exports.desc = 'method to remove a user from a tenant';
exports.builder = (yargs) => {
	return yargs.options({
		'tenant-id': {
			alias: 'id',
			desc: 'the tenants id',
			default: process.env.TENANT_ID || 'diku'
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
		'recreate-user': {
			desc: 'recreate admin-user if already exists',
			boolean: true
		},
		'user-permissions': {
			desc: 'the permissions to set to the user',
			default: ['perms.all'],
			array: true
		}
	});
};

exports.handler = (argv) => {
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		okapiTryCount: 3
	});

	debug(argv);
	return okapitools.waitForOkapi().then(() => {
		return okapitools.userExists(argv.tenantId, argv.userId).then(exists => {
			if (exists && argv.recreateUser) {
				return removeUser.handler(argv);
			} else if (exists) {
				return Q.reject(`User with id ${argv.userId} already exists`);
			} else {
				return Q.resolve();
			}
		}).then(() => {
			return okapitools.createUser(argv.tenantId, {
				id: argv.userId,
				username: argv.userName,
				active: true
			}).then(user => {
				return Q.all([
					okapitools.createUserCredentials(argv.tenantId, user, argv.userPassword),
					okapitools.createUserPermissions(argv.tenantId, user, argv.userPermissions)
				]);
			});
		});
	}).then('done' + console.log).catch(console.error);
};