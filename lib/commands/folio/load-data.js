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

exports.command = 'load-data';
exports.desc = 'loads data into folio';
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
		'dir': {
			desc: 'folder of json-files to load',
			required: true
		},
		'sort': {
			desc: 'with a comma-delimited list of endpoints to force data to load in order, e.g. `--sort location-units/institutions,location-units/campuses`',
			default: ''
		},
		'custom-method': {
			desc: 'with a comma-delimited list of endpoints and methods to set up custom methods, e.g. `--custom-method loan-rules-storage=PUT,locations=PUT`',
			default: ''
		},
		'only': {
			desc: 'only import what is specified by sort or custom-method',
			default: false,
			boolean: true
		},
	});
};

exports.handler = (argv) => {
	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		okapiTryCount: 3,
		introduceModuleTryCount: 3,
	});

	const sortList = argv.sort.split(',');
	if (!argv.only) sortList.push('');
	sortList.filter((item, index, self) => self.indexOf(item) === index);

	const methodList = argv.customMethod.split(',');
	if (!argv.only) methodList.push('');
	methodList.filter((item, index, self) => self.indexOf(item) === index);

	okapitools.waitForOkapi().then(() => {
		return okapitools.login(argv.tenantId, argv.userName, argv.userPassword);
	}).then(session => {
		return okapitools.loadData(argv.tenantId, session.token, argv.dir.replace(/\/$/, ''), sortList, methodList);
	}).then(() => console.log('done')).catch(console.error);
};