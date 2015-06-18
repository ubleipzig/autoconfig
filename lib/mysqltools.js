'use strict';

var Q = require('q');
var fs = require('fs');
var path = require('path');
var program = require('commander');
var mysql = require('mysql');
var _ = require('underscore');
var ini = require('ini');

var adminOptions;

module.exports = function (options) {
	if (!options) {
		try {
			var data = fs.readFileSync(path.join(process.env.HOME, '.my.cnf'), {encoding: 'utf8'});
			var myCnf = ini.decode(data);
			if (myCnf && myCnf.client) options = myCnf.client;
		} catch (err) {
			console.log('could not parse.my.cnf');
		}
	}

	adminOptions = _.extend({
		host: 'localhost',
		port: 3306,
		user: 'root'
	}, options);

	return {
		prepare: prepare,
		importSql: importSQL
	}
};

function prepare(url) {
	var deferred = Q.defer();

	testDbUrl(url)
		.then(function() {
			if (program.drop) {
				return dropDatabase(url)
					.then(dropUser)
					.then(prepare)
					.catch(deferred.reject);
			} else {
				deferred.resolve();
			}
		})
		.then(deferred.resolve)
		.catch(function (dbOptions) {
			findDatabase(dbOptions)
				.then(function (dbOptions) {
					return reuseOrDrop(dbOptions)
						.then(prepare)
						.catch(deferred.reject);
				})
				.catch(function (dbOptions) {
					if (dbOptions instanceof Error) return deferred.reject(dbOptions);
					createDatabase(dbOptions)
						.then(createUser)
						.then(function(result) {
							deferred.resolve(result);
						})
						.catch(function(err) {
							deferred.reject(err);
						});
				});

		});
	return deferred.promise
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
		.catch(deferred.reject);

	return deferred.promise;
}

function reuseOrDrop(dbOptions) {
	var deferred = Q.defer();

	if (program.force) {
		createUser(dbOptions)
			.then(deferred.resolve)
			.catch(deferred.reject);
	} else if (program.drop) {
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
		sql: "GRANT ALL ON ??.* to ?@? identified by ?",
		values: [dbOptions.database, dbOptions.user, program.dbClient, dbOptions.password]
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
			deferred.reject(err)
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
			deferred.reject(err)
		});

	return deferred.promise;
}

function dropUser(dbOptions) {
	process.stdout.write('dropping user .... ');
	var deferred = Q.defer();
	if (typeof(dbOptions) === 'string') dbOptions = mysql.createConnection(dbOptions).config;
	var statement = {
		sql: "DROP USER ?@'%'",
		values: [dbOptions.user]
	};

	promiseQuery(statement, adminOptions)
		.then(function () {
			console.log('done');
			deferred.resolve(dbOptions);
		})
		.catch(function(err) {
			console.log('failed');
			deferred.reject(dbOptions)
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
			if (err) return console.error('error while disconnecting from mysql server')
		});
	});

	return deferred.promise;
}
