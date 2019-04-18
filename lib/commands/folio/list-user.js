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

exports.command = 'list-user';
exports.desc = 'list user';
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
		}
	});
};

exports.handler = (argv) => {
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		okapiTryCount: 3
	});

	okapitools.waitForOkapi().then(() => {
		return okapitools.login(argv.tenantId, argv.userName, argv.userPassword);
	}).then(session => {
		return okapitools.userExists(argv.tenantId, argv.userId, session.token);
	}).then('done' + console.log).catch(console.error);
};