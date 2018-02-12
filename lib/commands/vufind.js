#!/usr/bin/env node

/**
	autoconfig

	Copyright (C) 2018 Leipzig University Library <info@ub.uni-leipzig.de>

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

exports.command = 'vufind <command>';
exports.desc = 'creates the config for a site and instance accordingly to defaults and custom overrides';
exports.builder = (yargs) => {
	return yargs
		.commandDir('vufind')
		.demandCommand()
		.env('VUFIND')
		.options({
			'site': {
				alias: 's',
				desc: 'specify the site to configure',
				demandOption: true
			},
			'basedir': {
				alias: 'b',
				desc: 'where the configuration is saved',
				default: '/usr/local/vufind/'
			},
			'instance': {
				alias: 'i',
				desc: 'the instance to set up',
				choices: ['alpha', 'staging', 'live'],
				demandOption: true
			},
			'db-server': {
				desc: 'the host that runs the db server',
				default: 'localhost'
			},
			'db-client': {
				desc: 'the host which the db server sees the db client as',
				default: 'localhost'
			},
			'db-backup-dir': {
				desc: 'backup-folder for databases',
				default: path.join(process.env.HOME, 'db_backup')
			},
			'db-admin-user': {
				desc: 'administrative user which is able to create databases and grant users access to them',
			},
			'db-admin-password': {
				desc: 'password of the administrative database user',
			}
		});
};