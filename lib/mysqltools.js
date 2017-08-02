'use strict';

var Q = require('q');
var fs = require('fs');
var path = require('path');
var mysql = require('mysql');
var mysqldump = require('mysqldump');
var _ = require('underscore');
var ini = require('multi-ini');

var adminOptions;
var dbClient;
var reuseDb;
var dropDb;

module.exports = function (options, client, reuse, drop) {
	var myCnf = {};
	try {
		myCnf = ini.read(path.join(process.env.HOME, '.my.cnf'), {encoding: 'utf8'}).client;
	} catch (err) {
		console.error('could not parse .my.cnf');
	}

	dbClient = client;
	reuseDb = reuse;
	dropDb = drop;

	adminOptions = _.extend({
		host: 'localhost',
		port: 3306,
		user: 'root'
	}, myCnf, options);

	return {
		prepare: prepare,
		importSql: importSQL,
		dumpSql: dumpSQL,
		dropDatabase: dropDatabase,
		dropUser: dropUser,
		findDatabase: findDatabase
	};
};

function prepare(url) {
	var deferred = Q.defer();

	// is the database url working
	testDbUrl(url)
		.then(function() {
			// and the database shall be dropped
			if (dropDb) {
				// drop database and user and begin again
				dropDatabase(url)
					.then(dropUser)
					.then(prepare)
					.then(deferred.resolve)
					.catch(deferred.reject);
			} else {
				deferred.resolve();
			}
		})
		// if the database url is not working
		.catch(function (dbOptions) {
			findDatabase(dbOptions)
				.then(function (dbOptions) {
					// if the database is existing reuse it by creating a new user or drop the database and begin again
					reuseOrDrop(dbOptions)
						.then(prepare)
						.then(deferred.resolve)
						.catch(deferred.reject);
				})
				// if there is no database
				.catch(function (dbOptions) {
					if (dbOptions instanceof Error) return deferred.reject(dbOptions);
					// restore database and create its user
					createDatabase(dbOptions)
						.then(createUser)
						.then(deferred.resolve)
						.catch(deferred.reject);
				});

		});
	return deferred.promise;
}

function importSQL(dbOptions, sqlFile) {
	process.stdout.write('importing table structure .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var options = _.extend(adminOptions, {
		multipleStatements: true,
		database: dbOptions.database
	});

	fs.readFile(sqlFile, {encoding: 'utf8'}, function (err, data) {
		if (err) return deferred.reject(err);

		promiseQuery(data, options)
			.then(function (result) {
				console.log('done');
				deferred.resolve(result.length);
			})
			.catch(deferred.reject);
	});

	return deferred.promise;
}

function dumpSQL(dbOptions, dumpOptions) {
	var dumpDefaults = {
		ifNotExist: false
	};

	process.stdout.write('dumping table structure .... ');
	var deferred = Q.defer();

	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var options = _.extend(adminOptions, {
		database: dbOptions.database
	}, dumpDefaults, dumpOptions);

	mysqldump(options, function (err, res) {
		if (err) return deferred.reject();
		console.log('done');
		deferred.resolve(res);
	});

	return deferred.promise;
}

function testDbUrl(url) {
	var deferred = Q.defer();

	promiseQuery(null, url)
		.then(deferred.resolve)
		.catch(function() {
			var c = mysql.createConnection(url);
			deferred.reject(_.pick(c.config, 'host', 'port', 'user', 'password', 'database'));
		});

	return deferred.promise;
}

function findDatabase(dbOptions) {
	process.stdout.write('looking for database .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: 'SHOW DATABASES WHERE `Database` = ?',
		values: [dbOptions.database]
	};

	promiseQuery(statement, adminOptions)
		.then(function (rows) {
			if (rows.length === 1) {
				console.log('found');
				deferred.resolve(dbOptions);
			} else {
				console.log('not found');
				deferred.reject(dbOptions);
			}
		})
		.catch(function(err) {
			console.log('error');
			deferred.reject(err);
		});

	return deferred.promise;
}

function reuseOrDrop(dbOptions) {
	var deferred = Q.defer();

	if (reuseDb) {
		reuseDb = null;
		createUser(dbOptions)
			.then(deferred.resolve)
			.catch(deferred.reject);
	} else if (dropDb) {
		dropDb = null;
		dropDatabase(dbOptions)
			.then(dropUser)
			.then(deferred.resolve)
			.catch(deferred.reject);
	} else {
		deferred.reject('neither the database shall be reused nor the old database shall be dropped. aborting');
	}
	return deferred.promise;
}

function createUser(dbOptions) {
	process.stdout.write('creating new user .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: 'GRANT ALL ON ??.* to ?@? identified by ?',
		values: [dbOptions.database, dbOptions.user, dbClient, dbOptions.password]
	};

	promiseQuery(statement, adminOptions)
		.then(function () {
			console.log('done');
			deferred.resolve(dbOptions);
		})
		.catch(function(err) {
			console.log('failed');
			deferred.reject(err);
		});

	return deferred.promise;
}

function createDatabase(dbOptions) {
	process.stdout.write('creating new database .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: 'CREATE DATABASE ??',
		values: [dbOptions.database]
	};

	promiseQuery(statement, adminOptions)
		.then(function () {
			console.log('done');
			deferred.resolve(dbOptions);
		})
		.catch(function(err) {
			console.log('failed');
			deferred.reject(err);
		});

	return deferred.promise;
}

function dropDatabase(dbOptions) {
	process.stdout.write('dropping database .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: 'DROP DATABASE ??',
		values: [dbOptions.database]
	};

	promiseQuery(statement, adminOptions)
		.then(function () {
			console.log('done');
			deferred.resolve(dbOptions);
		})
		.catch(function(err) {
			console.log('failed');
			deferred.reject(err);
		});

	return deferred.promise;
}

function dropUser(dbOptions) {
	process.stdout.write('dropping user .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: 'DROP USER ?@?',
		values: [dbOptions.user, dbClient]
	};

	promiseQuery(statement, adminOptions)
		.then(function () {
			console.log('done');
			deferred.resolve(dbOptions);
		})
		.catch(function(err) {
			console.log('failed');
			deferred.reject(err);
		});

	return deferred.promise;
}

function promiseQuery(statement, options) {
	var deferred = Q.defer();
	var connection = mysql.createConnection(options);

	connection.connect(function (err) {
		if (err) return deferred.reject(err);

		if (statement) {
			connection.query(statement, function (err, result) {
				if (err) return deferred.reject(err);
				deferred.resolve(result);
			});
		} else {
			deferred.resolve();
		}

		connection.end(function (err) {
			if (err) return console.error('error while disconnecting from mysql server');
		});
	});

	return deferred.promise;
}
