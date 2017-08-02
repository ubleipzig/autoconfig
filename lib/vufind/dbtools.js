'use strict';

var path = require('path');
var fs = require('fs');
var Q = require('q');
var ini = require('multi-ini');
var _ = require('underscore');
var url = require('url');
var pwgen = require('password-generator');

var options;

module.exports = function (overrides) {
	options = _.extend({
		tmpDir: '/tmp',
		backupDir: path.join(process.env.HOME, 'db_backup'),
		reuseDb: false,
		dropDb: false,
		restoreDb: false,
		dbClient: 'localhost',
		dbServer: 'localhost'
	}, overrides);

	return {
		createDb: createDb,
		removeDb: removeDb
	};
};

function createDb() {
	var deferred = Q.defer();

	try {
		var config = ini.read(options.instanceConfigIni, {encoding: 'utf8', keep_quotes: true});

		if (options.dbName) {
			if (!config.Database || !config.Database.database) {
				var dbCredentials = {
					protocol: 'mysql',
					slashes: true,
					pathname: options.dbName,
					auth: [options.dbName, pwgen(40, false, /[a-g0-9]/)].join(':'),
					host: options.dbServer
				};
			} else {
				var dbCredentials = url.parse(config.Database.database, true);
				var auth = dbCredentials.auth.split(':');
				dbCredentials.auth = [options.dbName, auth[1]].join(':');
				dbCredentials.pathname = options.dbName;
			}
			config.Database = {
				database: url.format(dbCredentials)
			};
			ini.write(options.instanceConfigIni, config, {encoding: 'utf8', keep_quotes: true});
		}

		if (!config.Database || !config.Database.database) {
			return deferred.reject('no database configuration found in ' + options.instanceConfigIni);
		}

		var mysqltools = require('../mysqltools')({
			host: dbCredentials.host
		}, options.dbClient, options.reuseDb, options.dropDb);

		mysqltools.prepare(config.Database.database)
			.then(function (dbOptions) {
				if (dbOptions && options.restoreDb) {
					mysqltools.importSql(dbOptions, path.join(options.backupDir, options.dbName + '.sql'))
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

function removeDb() {
	var deferred = Q.defer();

	try {
		var config = ini.read(options.instanceConfigIni, {
			encoding: 'utf8'
		});

		if (!config.Database || !config.Database.database) {
			throw new Error('no database configuration found in ' + options.instanceConfigIni);
		}

		try {
			fs.mkdirSync(options.backupDir, '0700');
		} catch (err) {
			if (err && err.code !== 'EEXIST') deferred.reject(err);
		}

		var dbCredentials = url.parse(config.Database.database, true);

		var mysqltools = require('../mysqltools')({
			host: dbCredentials.host
		}, options.dbClient, options.reuseDb, options.dropDb);
		mysqltools.findDatabase(config.Database.database).then(function (dbOptions) {
			var backupFile = path.join(options.backupDir, dbOptions.database + '.sql');
			return mysqltools.dumpSql(config.Database.database, {
				dest: backupFile
			});
		}).then(function () {
			return mysqltools.dropUser(config.Database.database).then(mysqltools.dropDatabase);
		}).then(deferred.resolve).catch(deferred.reject);

	} catch (err) {
		console.log('aborting');
		deferred.reject(err);
	}

	return deferred.promise;
}