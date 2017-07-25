/*global describe beforeEach afterEach it*/

'use strict';

var mysql = require('mysql');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var exec = require('child_process').exec;
var fs = require('fs');

require('should');

var dbClient;
exec('ip route show | grep -e "eth0  proto" | awk -F" " \'{ print $9 }\'', function (err, stdout) {
	dbClient = stdout.trim();
});
describe('mysqltools', function () {

	var basedir = path.join(process.cwd(), '.tmp');
	var importFile = path.join(process.cwd(), 'test', 'data', 'mysqltools', 'import.sql');
	var dumpFile = path.join(basedir, 'dump.sql');

	var mysqltoolsOptions = {
		host: process.env.MYSQL_HOST || 'db',
		port: process.env.MYSQL_PORT || '3306',
		user: process.env.MYSQL_USER || 'root',
		password: process.env.MYSQL_PASSWORD || null
	};

	var rootConnection;

	beforeEach(function (done) {
		mkdirp(basedir, function (err) {
			done(err);
		});
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
		rimraf(basedir, done);
	});

	describe('prepare', function () {

		describe('with no previously installed user and database', function () {
			afterEach(function (done) {
				rootConnection.query('DROP DATABASE testdb;', function () {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', dbClient]
					}, function () {
						done();
					});
				});
			});

			it('should create database and a user', function (done) {
				var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);

				mysqltools.prepare('mysql://testuser:testpasswd@db/testdb').then(function () {
					rootConnection.query('SHOW DATABASES WHERE `Database` = "testdb"', function (err, res) {
						res.length.should.eql(1);
						res[0].Database.should.eql('testdb');
						rootConnection.query('SELECT * FROM mysql.user where User = "testuser";', function (err, res) {
							if (err) return done(err);
							res.length.should.eql(1);
							res[0].should.containDeep({
								User: 'testuser',
								Host: dbClient,
							});
							rootConnection.query('SELECT * FROM mysql.db where User = "testuser";', function (err, res) {
								if (err) return done(err);
								res.length.should.eql(1);
								res[0].should.containDeep({
									User: 'testuser',
									Host: dbClient,
									Db: 'testdb'
								});
								done();
							});
						});
					});
				}).catch(done);
			});
		});

		describe('with previously installed user and database', function () {

			beforeEach(function (done) {
				var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
				mysqltools.prepare('mysql://testuser:oldtestpw@db/testdb').then(function () {
					rootConnection.query('CREATE TABLE `testdb`.`table` (`id` int(11))', function (err) {
						if (err) return done(err);
						done();
					});
				}).catch(done);
			});

			afterEach(function (done) {
				rootConnection.query('DROP DATABASE testdb;', function () {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', dbClient]
					}, function () {
						done();
					});
				});
			});

			describe('with working credentials', function () {
				describe('and no desicion about reuse or drop', function () {

					it('should do nothing', function (done) {
						var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
						mysqltools.prepare('mysql://testuser:oldtestpw@db/testdb').then(function () {
							rootConnection.query('SELECT `id` FROM `testdb`.`table`', function (err) {
								if (err) return done(err);
								done();
							});
						}).catch(function (err) {
							done(err);
						});
					});
				});

				describe('and choosed to drop', function () {

					it('should do nothing', function (done) {
						var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient, false, true);
						mysqltools.prepare('mysql://testuser:oldtestpw@db/testdb').then(function () {
							rootConnection.query('SELECT `id` FROM `testdb`.`table`', function (err) {
								if (err && err.code === 'ER_NO_SUCH_TABLE') return done();
								done(new Error('no error was thrown'));
							});
						}).catch(function (err) {
							done(err);
						});
					});
				});
			});

			describe('with non working credentials', function () {
				describe('and no desicion about reuse or drop', function () {
					it('should throw en error', function (done) {
						var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
						mysqltools.prepare('mysql://testuser:testpasswd@db/testdb').then(function () {
							done(new Error('no error was thrown'));
						}).catch(function (err) {
							err.should.eql('neither the database shall be reused nor the old database shall be dropped. aborting');
							done();
						});
					});
				});

				describe('and choosed to reuse', function () {
					it('should reset user credentials', function (done) {
						var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient, true);
						mysqltools.prepare('mysql://testuser:testpasswd@db/testdb').then(function () {
							rootConnection.query('SELECT `id` FROM `testdb`.`table`', function (err) {
								if (err) return done(err);
								done();
							});
						}).catch(function (err) {
							done(err);
						});
					});
				});

				describe('and choosed to drop', function () {
					it('should reset user credentials', function (done) {
						var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient, false, true);
						mysqltools.prepare('mysql://testuser:testpasswd@db/testdb').then(function () {
							rootConnection.query('SELECT `id` FROM `testdb`.`table`', function (err) {
								if (err && err.code === 'ER_NO_SUCH_TABLE') return done();
								done(new Error('no error was thrown'));
							});
						}).catch(function (err) {
							done(err);
						});
					});
				});
			});
		});
	});

	describe('importSQL', function () {
		beforeEach(function (done) {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			mysqltools.prepare('mysql://testuser:testpw@db/testdb').then(function () {
				done();
			}).catch(done);
		});

		afterEach(function (done) {
			rootConnection.query('DROP DATABASE testdb;', function () {
				rootConnection.query({
					sql: 'DROP USER ?@?',
					values: ['testuser', dbClient]
				}, function () {
					done();
				});
			});
		});

		describe('importing an sqldump', function () {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should create a table structure', function (done) {
				mysqltools.importSql('mysql://testuser:testpw@db/testdb', importFile).then(function () {
					rootConnection.query('SELECT `id` FROM `testdb`.`comments`', function (err) {
						if (err) return done(err);
						done();
					});
				});
			});

		});
	});

	describe('dumpSQL', function () {
		beforeEach(function (done) {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			mysqltools.prepare('mysql://testuser:testpw@db/testdb').then(function () {
				return mysqltools.importSql('mysql://testuser:testpw@db/testdb', importFile);
			}).then(function () {
				done();
			}).catch(done);
		});

		afterEach(function (done) {
			rootConnection.query('DROP DATABASE testdb;', function () {
				rootConnection.query({
					sql: 'DROP USER ?@?',
					values: ['testuser', dbClient]
				}, function () {
					done();
				});
			});
		});

		describe('dumping to a sql-file', function () {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should dump a table structure', function (done) {
				mysqltools.dumpSql('mysql://testuser:testpw@db/testdb', {
					dest: dumpFile
				}).then(function () {
					fs.stat(dumpFile, function (err) {
						if (err) done(err);
						done();
					});
				}).catch(done);
			});
		});
	});

	describe('dropDatabase', function () {
		describe('dropping an existing database', function () {
			beforeEach(function (done) {
				var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
				mysqltools.prepare('mysql://testuser:testpw@db/testdb').then(function () {
					done();
				}).catch(done);
			});

			afterEach(function (done) {
				rootConnection.query('DROP DATABASE testdb;', function () {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', dbClient]
					}, function () {
						done();
					});
				});
			});

			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should remove the database', function (done) {
				mysqltools.dropDatabase('mysql://testuser:testpw@db/testdb').then(function () {
					rootConnection.query('USE testdb', function (err) {
						if (err && err.code === 'ER_BAD_DB_ERROR') return done();
						done(new Error('no error was thrown'));
					});
				}).catch(done);
			});
		});

		describe('dropping a non-existing database', function () {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should throw an error', function (done) {
				mysqltools.dropDatabase('mysql://testuser:testpw@db/testdb').then(function () {
					done(new Error('no error was thrown'));
				}).catch(function (err) {
					if (err.code === 'ER_DB_DROP_EXISTS') return done();
					done(err);
				});
			});
		});
	});

	describe('dropUser', function () {
		describe('dropping an existing user', function () {
			beforeEach(function (done) {
				var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
				mysqltools.prepare('mysql://testuser:testpw@db/testdb').then(function () {
					done();
				}).catch(done);
			});

			afterEach(function (done) {
				rootConnection.query('DROP DATABASE testdb;', function () {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', dbClient]
					}, function () {
						done();
					});
				});
			});

			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should remove the user', function (done) {
				mysqltools.dropUser('mysql://testuser:testpw@db/testdb').then(function () {
					rootConnection.query({
						sql: 'SELECT User FROM `mysql`.`user` where User = ? and host = ?',
						values: ['testuser', dbClient]
					}, function (err, res) {
						if (err) return done(err);
						res.length.should.eql(0);
						done();
					});
				}).catch(done);
			});
		});

		describe('dropping a non-existing user', function () {
			var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
			it('should throw an error', function (done) {
				mysqltools.dropUser('mysql://testuser:testpw@db/testdb').then(function () {
					done(new Error('no error was thrown'));
				}).catch(function (err) {
					if (err.code === 'ER_CANNOT_USER') return done();
					done(err);
				});
			});
		});
	});

	describe('findDatabase', function () {
		var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);

		describe('finding an existing database', function() {
			beforeEach(function (done) {
				var mysqltools = require('../lib/mysqltools')(mysqltoolsOptions, dbClient);
				mysqltools.prepare('mysql://testuser:testpw@db/testdb').then(function () {
					return mysqltools.importSql('mysql://testuser:testpw@db/testdb', importFile);
				}).then(function () {
					done();
				}).catch(done);
			});

			afterEach(function(done) {
				rootConnection.query('DROP DATABASE testdb;', function() {
					rootConnection.query({
						sql: 'DROP USER ?@?',
						values: ['testuser', dbClient]
					}, function () {
						done();
					});
				});
			});

			it('should end ok', function(done) {
				mysqltools.findDatabase('mysql://testuser:testpw@db/testdb').then(function() {
					done();
				}).catch(done);
			});
		});
		describe('finding a non-existing database', function() {
			it('should end with en error', function(done) {
				mysqltools.findDatabase('mysql://testuser:testpw@db/testdb').then(function() {
					done(new Error('no error was thrown'));
				}).catch(function(err) {
					if (err && err.code === 'ER_BAD_DB_ERROR') return done();
				});
			});
		});

	});
});