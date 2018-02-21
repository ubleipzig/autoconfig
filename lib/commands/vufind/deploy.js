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

const Q = require('q');
const path = require('path');
const crypto = require('crypto');

exports.command = 'deploy';
exports.aliases = 'd';
exports.desc = 'creates the config for a site and instance accordingly to defaults and custom overrides';
exports.builder = (yargs) => {
	return yargs
		.options({
			'settings-dir': {
				alias: ['c', 'configs'],
				desc: 'the folder with instance default settings.',
				default: path.join(process.env.HOME, '.autoconfig')
			},
			'reuse-db': {
				alias: 'f',
				desc: 'reuses an existing database by recreating credentials according to defaults',
				boolean: true,
				default: false
			},
			'drop-db': {
				alias: 'd',
				desc: 'drops an existing database',
				boolean: true,
				default: false
			},
			'hash-id': {
				desc: 'creates a unique deploy-id from basedir (used for db name/user and config-json',
				boolean: true,
				default: false
			},
			'restore-db': {
				desc: 'restores db, if backup exists',
				boolean: true,
				default: true
			},
			'skip-config': {
				desc: 'skip generating config',
				boolean: true,
				default: false
			},
			'skip-db': {
				desc: 'skip creating/importing database',
				boolean: true,
				default: false
			},
			'skip-grunt': {
				desc: 'skip generating css via sass',
				boolean: true,
				default: false
			},
			'skip-composer': {
				desc: 'skip installing third-party components required by vufind',
				boolean: true,
				default: false
			},
			'update-settings': {
				desc: 'updates the default instance settings',
				default: false,
				boolean: true
			},
			'import-sql-file': {
				desc: 'the path relative to basedir of the sqlfile to import',
				default: 'module/VuFind/sql/mysql.sql'
			},
			'vf.config_ini.Index.url': {
				alias: 'solr-url',
				desc: 'the url to the solr'
			},
			'vf.config_ini.Site.url': {
				alias: ['url', 'u'],
				desc: 'the url of this site',
			}
		});
};

exports.handler = (argv) => {
	if (argv._.length > 2) {
		console.error('please specify exactly one site to set up');
		process.exit(2);
	}

	var hash = crypto.createHash('sha').update(argv.basedir).digest('hex');

	if (argv.hashId) {
		var hashId = hash.substr(0, 4) + hash.substr(10, 4) + hash.substr(26, 4) + hash.substr(36, 4);
	} else if (('vufind_' + argv.site).length > 16) {
		var dbName = hash.substr(0, 4) + hash.substr(10, 4) + hash.substr(26, 4) + hash.substr(36, 4);
	} else {
		var dbName = 'vufind_' + argv.site;
	}

	var deployId = hashId || argv.site;

	var configTools = require('../../vufind/configtools')({
		basedir: argv.basedir,
		site: argv.site,
		instance: argv.instance,
		deployId: deployId,
		dbName: hashId || dbName,
		dbServer: argv.dbServer,
		args: argv.vf || {},
		settingsFile: path.join(argv.configs, deployId + '.json')
	});

	var dbTools = require('../../vufind/dbtools')({
		backupDir: argv.dbBackupDir,
		reuseDb: argv.reuseDb,
		dropDb: argv.dropDb,
		restoreDb: argv.restoreDb,
		dbClient: argv.dbClient,
		adminUser: argv.dbAdminUser,
		adminPassword: argv.dbAdminPassword,
		importSqlFile: path.join(argv.basedir, argv.importSqlFile)
	});

	const gruntTools = require('../../grunttools')({
		basedir: argv.basedir
	});

	const composerTools = require('../../composertools')({
		basedir: argv.basedir
	});

	const skipConfig = argv.skipConfig ? Q() : undefined;
	const skipDb = argv.skipDb ? Q() : undefined;
	const skipGrunt = argv.skipGrunt ? Q() : undefined;
	const skipComposer = argv.skipComposer ? Q() : undefined;
	const skipUpdateSettings = argv.updateSettings ? undefined : Q();

	// spread all tasks
	Q.all([
		skipConfig || configTools.processConfig().then(config => {
			return skipUpdateSettings || configTools.updateSettings(config);
		}).then(() => {
			return skipDb || configTools.findTargetConfigs().then(config => {
				if (!config['config.ini'] || !config['config.ini'].Database || !config['config.ini'].Database.database) {
					throw new Error('no database configuration found');
				}
				return dbTools.createDb(config['config.ini'].Database.database);
			});
		}),
		skipGrunt || (function () {
			var deferred = Q.defer();
			gruntTools.grunt().then(deferred.resolve).catch(function () {
				console.log('something went wrong while doing `grunt`-related job, continuing nevertheless');
				deferred.resolve();
			});
			return deferred.promise;
		})(),
		skipComposer || composerTools.composer()
	]).catch(console.error);
};