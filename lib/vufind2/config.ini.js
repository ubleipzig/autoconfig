'use strict';

var _ = require('underscore');
var pwgen = require('password-generator');
var Q = require('q');
var mysql = require('mysql');
var fs = require('fs');
var relativeSqlFile = 'module/VuFind/sql/mysql.sql';
var path = require('path');
var program = require('commander');

var rootOptions = {
	host: 'localhost',
	port: 3306,
	user: 'root',
	password: 'rootpw',
	database: 'mysql'
};

var options;

var defaults;

module.exports = function (o, d) {
	var deferred = Q.defer();

	defaults = d;
	options = o;

	if (!defaults.Database || !defaults.Database.database) {
		console.log('no database config. creating one ...');

		var user = 'vufind2_' + options.site;
		var database = user;
		var password = pwgen(16, false);

		defaults.Database = {
			database: 'mysql://' + user + ':' + password + "@localhost/" + database
		}
	}

	if (!defaults.Index || !defaults.Index.url ) {
		defaults = _.extend(defaults, { Index: { url: 'http://172.18.85.142:8085/solr' }});
	}

	if (!defaults.Authentication || !defaults.Authentication.encryption_key) {
		_.extend(defaults, {Authentication: {encryption_key: pwgen(40, false, /[a-g0-9]/) }});
	}

	var config = _.extend({
		Site: {
			url: 'https://staging.finc.info/vufind2/' + options.site
		}
	}, defaults);

	testDbUrl(defaults.Database.database).then(function() {
		console.log('database credentials are working');
		deferred.resolve(config);
	}).catch(function(dbOptions) {
		console.log('connecting to database with given credentials is not working');
		findDatabase(dbOptions).then(function(dbOptions) {
			var d = Q.defer();
			if (program.drop) {
				dropDatabase(dbOptions).then(function () {
					d.reject(dbOptions);
				});
			} else if (program.force) {
				createUser(dbOptions).then(function() {
					d.resolve('new user credentials saved for existing database');
				}).reject(function(err) {
					deferred.reject(err);
				});
			}
			return deferred.promise;
		}).catch(function(dbOptions) {
			console.log('configured database not found');
			createDatabase(dbOptions).then(createUser).then(importSQL).then(function() {
				console.log('successfully created database');
				deferred.resolve(config);
			}).catch(function(err) {
				console.error('could not create database or import SQL');
				console.error(err);
			})
		})
	});

	return deferred.promise;
};

function testDbUrl(url) {
	var deferred = Q.defer();

	var connection = mysql.createConnection(url);

	connection.connect(function(err) {
		if (!err)  {
			connection.end(function(err) {
				if (err) return console.error('could not end mysql connection');
				return deferred.resolve();
			});
		} else {
			deferred.reject(_.pick(connection.config, 'host', 'port', 'user', 'password', 'database'));
		}
	});

	return deferred.promise;
}

function findDatabase(config) {
	var deferred = Q.defer();

	var stmt = {
		sql: 'SHOW DATABASES WHERE `Database` = ?',
		values: [config.database]
	};

	var connection = mysql.createConnection(rootOptions);

	connection.query(stmt, function (err, rows) {
		if (err) return deferred.reject(err);

		if (rows.length === 1) {
			deferred.resolve(config);
		} else {
			deferred.reject(config);
		}

		connection.end(function(err) {
			if (err) return console.err('could not end mysql connection');
		});
	});

	return deferred.promise;
}

function createDatabase(config) {
	var deferred = Q.defer();

	var statement = {
		sql: 'CREATE DATABASE ??',
		values: [config.database]
	};

	var connection = mysql.createConnection(rootOptions);

	connection.query(statement, function (err) {
		if (err) return deferred.reject(err);
		connection.end(function(err) {
			if (err) return console.err('could not end mysql connection');
			deferred.resolve(config);
		});
	});

	return deferred.promise;
}

function createUser(config) {
	var deferred = Q.defer();

	var statement = {
		sql: "GRANT ALL ON ??.* to ?@'%' identified by ?",
		values: [config.database, config.user, config.password]
	};

	var connection = mysql.createConnection(rootOptions);

	connection.query(statement, function (err) {
		if (err) return deferred.reject(err);
		connection.end(function(err) {
			if (err) return console.err('could not end mysql connection');
			deferred.resolve(config);
		});
	});

	return deferred.promise;
}

function dropDatabase(config) {
	var deferred = Q.defer();

	var dropDatabaseStatement = {
		sql: 'DROP DATABASE ??',
		values: [config.database]
	};

	var dropUserStatement = {
		sql: "DROP USER ?@'%'",
		values: [config.user]
	};

	var connection = mysql.createConnection(rootOptions);

	connection.query(dropDatabaseStatement, function (err) {
		if (err) {
			console.error(err);
		} else {
			console.log('removed existing database ' + config.database);
		}

		deferred.resolve(config);
	});

	connection.query(dropUserStatement, function (err) {
		if (err) return console.error(err);
		console.log('removed existing user ' + config.user);
	});

	connection.end(function(err) {
		if (err) console.error('could not end mysql connection');
	});

	return deferred.promise;
}

function importSQL(config) {
	var deferred = Q.defer();
	var sqlFile = path.join(options.baseDir, options.site, relativeSqlFile);

	fs.readFile(sqlFile, { encoding: 'utf8' }, function(err, data) {
		if (err) return deferred.reject(err);


		var connection = mysql.createConnection(_.extend(rootOptions, {
			multipleStatements: true,
			database: config.database
		}));

		connection.query(data, function (err, results) {
			if (err) return deferred.reject(err);
			deferred.resolve(results.length);

			connection.end(function(err) {
				if (err) return console.err('could not end mysql connection');
			});

		});
	});

	return deferred.promise;
}