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

exports.command = 'undeploy';
exports.aliases = 'u';
exports.desc = 'removes the database for a specified site';
exports.builder = (yargs) => {
	return yargs
		.options({
			'no-backup': {
				desc: 'do not create a database backup',

			}
		});
};

exports.handler = (argv) => {
	if (argv._.length > 2) {
		console.error('please specify exactly one site to set up');
		process.exit(2);
	}

	var configTools = require('../../vufind/configtools')({
		basedir: argv.basedir,
		site: argv.site,
		instance: argv.instance
	});

	var dbTools = require('../../vufind/dbtools')({
		backupDir: argv.dbBackupDir,
		reuseDb: argv.reuseDb,
		dropDb: argv.dropDb,
		restoreDb: argv.restoreDb,
		dbClient: argv.dbClient,
		adminUser: argv.dbAdminUser,
		adminPassword: argv.dbAdminPassword,
		importSqlFile: path.join(argv.basedir, 'module/VuFind/sql/mysql.sql')
	});

	// spread all tasks
	configTools.findTargetConfigs().then(config => {
		if (!config['config.ini'] || !config['config.ini'].Database || !config['config.ini'].Database.database) {
			throw new Error('no database configuration found');
		}

		return dbTools.removeDb(config['config.ini'].Database.database).then(function (backupFile) {
			console.log(`site removed successfully. Database backup saved to ${backupFile}`);
		});
	}).catch(console.error);
};