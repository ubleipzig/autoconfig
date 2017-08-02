/*global describe before beforeEach afterEach it*/

'use strict';

var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var exec = require('child_process').exec;
var cp = require('cp');
var mysql = require('mysql');
var _ = require('underscore');
var fs = require('fs');
var ini = require('multi-ini');
var url = require('url');
require('should');

var tmpDir = path.join(process.cwd(), '.tmp');
var configFile = path.join(process.cwd(), 'test', 'data', 'dbtools', 'config.ini');
var configFileNoDbCreds = path.join(process.cwd(), 'test', 'data', 'dbtools', 'configNoDbCreds.ini');
var backupFile = path.join(process.cwd(), 'test', 'data', 'dbtools', 'backup.sql');

var options = {
	basedir: tmpDir,
	tmpDir: '/tmp',
	backupDir: path.join(tmpDir, 'db_backup'),
	dbServer: 'db',
	dbName: 'testdb',
	reuseDb: false,
	dropDb: false,
	instance: 'staging',
	vanillaSqlFile: path.join(process.cwd(), 'test', 'data', 'mysqltools', 'import.sql'),
	instanceConfigIni: path.join(tmpDir, 'config', 'config.ini')
};

exec('ip route show | grep -e "eth0  proto" | awk -F" " \'{ print $9 }\'', function (err, stdout) {
	options.dbClient = stdout.trim();
});


describe('dbtools', function () {
	beforeEach(function (done) {
		mkdirp(options.basedir, function (err) {
			done(err);
		});
	});

	var rootConnection;

	beforeEach(function (done) {
		try {
			mkdirp.sync(path.join(tmpDir, 'config'));
			mkdirp.sync(options.backupDir);
			done();
		} catch (err) {
			done(err);
		}
	});

	beforeEach(function (done) {
		try {
			mkdirp.sync(path.join(tmpDir, 'config'));
			mkdirp.sync(options.backupDir);
			done();
		} catch (err) {
			done(err);
		}
	});

	beforeEach(function (done) {
		rootConnection = mysql.createConnection('mysql://root@db/');
		rootConnection.connect(function (err) {
			done(err);
		});
	});

	afterEach(function (done) {
		rootConnection.end(function (err) {
			done(err);
		});
	});

	afterEach(function (done) {
		rimraf(options.basedir, done);
	});

	describe('createDb', function () {

		describe('with non-existing config.ini', function () {
			it('should throw an error', function (done) {
				var dbtools = require('../lib/vufind/dbtools')(options);
				dbtools.createDb().then(function () {
					done(new Error('no error was thrown'));
				}).catch(function (err) {
					if (err.code === 'ENOENT') return done();
					done(err);
				});
			});
		});

		describe('with existing config.ini and database credentials', function () {
			beforeEach(function (done) {
				cp(configFile, options.instanceConfigIni, done);
			});

			describe('and default db naming', function () {
				afterEach(function (done) {
					rootConnection.query('DROP DATABASE testdb;', function () {
						rootConnection.query({
							sql: 'DROP USER ?@?',
							values: ['testuser', options.dbClient]
						}, function () {
							done();
						});
					});
				});
				describe('and no backup file', function () {
					it('should create a database with vanilla table structure', function (done) {
						var dbtools = require('../lib/vufind/dbtools')(options);
						dbtools.createDb().then(function () {
							rootConnection.query('SELECT `id` FROM `testdb`.`comments`', function (err, res) {
								if (err) return done(err);
								res.should.be.an.Array();
								res.length.should.eql(0);
								done();
							});
						}).catch(done);
					});
				});
				describe('and existing backup file', function () {
					beforeEach(function (done) {
						cp(backupFile, path.join(options.backupDir, 'testdb.sql'), done);
					});
					describe('with restore-flag', function () {

						it('should create a database with table structure from backup file', function (done) {
							var dbtools = require('../lib/vufind/dbtools')(_.extend({}, options, {
								restoreDb: true
							}));
							dbtools.createDb().then(function () {
								rootConnection.query('SELECT `id` FROM `testdb`.`comments`', function (err, res) {
									if (err) return done(err);
									res.should.be.an.Array();
									res.length.should.eql(1);
									// INSERT INTO `comments` VALUES (1,11,111,'example comment','2017-07-12 00:00:00');
									done();
								});
							}).catch(done);
						});
					});
					describe('without restore-flag', function () {

						it('should create a database with vanilla table structure', function (done) {
							var dbtools = require('../lib/vufind/dbtools')(options);
							dbtools.createDb().then(function () {
								rootConnection.query('SELECT `id` FROM `testdb`.`comments`', function (err, res) {
									if (err) return done(err);
									res.should.be.an.Array();
									res.length.should.eql(0);
									done();
								});
							}).catch(done);
						});

					});

				});

			});
			describe('and enabled db-name-hashing', function () {
				afterEach(function (done) {
					rootConnection.query('DROP DATABASE d7a54761a93b9941f5bfb5d2d868b2b0;', function () {
						rootConnection.query({
							sql: 'DROP USER ?@?',
							values: ['d7a54761a93b9941f5bfb5d2d868b2b0', options.dbClient]
						}, function () {
							done();
						});
					});
				});

				beforeEach(function (done) {
					cp(configFile, options.instanceConfigIni, function (err) {
						if (err) return done(err);
						var dbtools = require('../lib/vufind/dbtools')(_.extend({}, options, {
							dbName: 'd7a54761a93b9941f5bfb5d2d868b2b0'
						}));
						dbtools.createDb().then(function () {
							done();
						}).catch(done);
					});
				});

				it('should create a database with vanilla table structure and modify the config.ini', function (done) {
					rootConnection.query('SELECT `id` FROM `d7a54761a93b9941f5bfb5d2d868b2b0`.`comments`', function (err, res) {
						if (err) return done(err);
						res.should.be.an.Array();
						res.length.should.eql(0);

						var modifiedIni = ini.read(options.instanceConfigIni, {
							encoding: 'utf8'
						});
						var dbCredentials = url.parse(modifiedIni.Database.database);
						dbCredentials.path.should.eql('/d7a54761a93b9941f5bfb5d2d868b2b0');
						var auth = dbCredentials.auth.split(':');
						auth[0].should.eql('d7a54761a93b9941f5bfb5d2d868b2b0');
						done();
					});
				});
			});
		});

		describe('with existing config.ini but no database credentials', function () {
			beforeEach(function (done) {
				cp(configFileNoDbCreds, options.instanceConfigIni, function (err) {
					if (err) return done(err);
					var dbtools = require('../lib/vufind/dbtools')(_.extend({}, options, {
						dbName: 'testdb'
					}));
					dbtools.createDb().then(function () {
						done();
					}).catch(done);
				});
			});

			afterEach(function (done) {
				rootConnection.query('DROP DATABASE testdb;', function () {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', options.dbClient]
					}, function () {
						done();
					});
				});
			});

			it('should create a database with vanilla table structure and modify the config.ini', function (done) {
				rootConnection.query('SELECT `id` FROM `testdb`.`comments`', function (err, res) {
					if (err) return done(err);
					res.should.be.an.Array();
					res.length.should.eql(0);

					var modifiedIni = ini.read(options.instanceConfigIni, {
						encoding: 'utf8'
					});
					var dbCredentials = url.parse(modifiedIni.Database.database);
					dbCredentials.path.should.eql('/testdb');
					var auth = dbCredentials.auth.split(':');
					auth[0].should.eql('testdb');
					auth[1].length.should.eql(40);
					done();
				});
			});
		});

	});

	describe('removeDb', function () {
		describe('with existing config.ini', function () {
			beforeEach(function (done) {
				cp(configFile, options.instanceConfigIni, done);
			});

			describe('and existing database', function () {
				var dbtools = require('../lib/vufind/dbtools')(options);
				beforeEach(function (done) {
					dbtools.createDb().then(function () {
						done();
					}).catch(done);
				});

				afterEach(function (done) {
					rootConnection.query('DROP DATABASE testdb', function () {
						rootConnection.query({
							sql: 'DROP USER ?@?',
							values: ['testuser', options.dbClient]
						}, function () {
							done();
						});
					});
				});

				it('should remove the database and create a backup sql', function (done) {
					dbtools.removeDb().then(function () {
						fs.existsSync(path.join(options.backupDir, 'testdb.sql')).should.be.true();
						rootConnection.query('SHOW DATABASES WHERE `Database` = "testdb"', function (err, res) {
							if (err) return done(err);
							res.length.should.eql(0);
							done();
						});
					}).catch(done);
				});
				describe('and existing backup-file', function () {
					beforeEach(function (done) {
						fs.writeFileSync(path.join(options.backupDir, 'testdb.sql'), 'foobar');
						fs.statSync(path.join(options.backupDir, 'testdb.sql')).size.should.eql(6);
						done();
					});
					it('should overwrite the existing backup-file', function (done) {
						dbtools.removeDb().then(function () {
							fs.existsSync(path.join(options.backupDir, 'testdb.sql')).should.be.true();
							fs.statSync(path.join(options.backupDir, 'testdb.sql')).size.should.eql(7123);
							rootConnection.query('SHOW DATABASES WHERE `Database` = "testdb"', function (err, res) {
								if (err) return done(err);
								res.length.should.eql(0);
								done();
							});
						}).catch(done);
					});
				});
			});
			describe('and non-existing database', function () {
				var dbtools = require('../lib/vufind/dbtools')(options);
				it('should throw an error', function (done) {
					dbtools.removeDb().then(function () {
						done(new Error('no error was thrown'));
					}).catch(function () {
						fs.existsSync(path.join(options.backupDir, 'testdb.sql')).should.be.false();
						done();
					});
				});
			});
		});
		describe('with non-existing config.ini', function () {
			var dbtools = require('../lib/vufind/dbtools')(options);
			it('should throw an error', function (done) {
				dbtools.removeDb().then(function () {
					done(new Error('no error was thrown'));
				}).catch(function () {
					fs.existsSync(path.join(options.backupDir, 'testdb.sql')).should.be.false();
					done();
				});
			});
		});
	});
});