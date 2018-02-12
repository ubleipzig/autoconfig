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

var path = require('path');
var fs = require('fs');
var Q = require('q');
var _ = require('underscore');
var url = require('url');

var options;

module.exports = function (overrides) {
	options = _.extend({
		tmpDir: '/tmp',
		backupDir: path.join(process.env.HOME, 'db_backup'),
		reuseDb: false,
		dropDb: false,
		restoreDb: false,
		dbClient: 'localhost'
	}, overrides);

	return {
		createDb: createDb,
		removeDb: removeDb
	};
};

function createDb(dsn) {
	var deferred = Q.defer();

	try {
		var dbCredentials = url.parse(dsn, true);

		var mysqltools = require('../mysqltools')({
			host: dbCredentials.host
		}, options.dbClient, options.reuseDb, options.dropDb);

		mysqltools.prepare(dsn)
			.then(function (dbOptions) {
				if (dbOptions && options.restoreDb) {
					mysqltools.importSql(dbOptions, path.join(options.backupDir, dbCredentials.pathname.replace(/^\//, '') + '.sql'))
						.then(deferred.resolve)
						// no backup sql file? initialize a vanilla table structure
						.catch(function () {
							mysqltools.importSql(dbOptions, path.join(options.vanillaSqlFile)).then(deferred.resolve).catch(deferred.reject);
						});
				} else if (dbOptions) {
					mysqltools.importSql(dbOptions, path.join(options.vanillaSqlFile)).then(deferred.resolve).catch(deferred.reject);
				} else {
					deferred.resolve();
				}

			}).catch(deferred.reject);
	} catch (err) {
		deferred.reject(err);
	}

	return deferred.promise;
}

function removeDb(dsn) {
	var deferred = Q.defer();

	try {
		try {
			fs.mkdirSync(options.backupDir, '0700');
		} catch (err) {
			if (err && err.code !== 'EEXIST') deferred.reject(err);
		}

		var dbCredentials = url.parse(dsn, true);

		var mysqltools = require('../mysqltools')({
			host: dbCredentials.host
		}, options.dbClient, options.reuseDb, options.dropDb);
		mysqltools.findDatabase(dsn).then(function (dbOptions) {
			var backupFile = path.join(options.backupDir, dbOptions.database + '.sql');
			return mysqltools.dumpSql(dsn, {
				dest: backupFile
			}).then(function () {
				return mysqltools.dropUser(dsn).then(mysqltools.dropDatabase);
			}).then(function () {
				deferred.resolve(backupFile);
			});
		}).catch(deferred.reject);
	} catch (err) {
		console.log('aborting');
		deferred.reject(err);
	}

	return deferred.promise;
}