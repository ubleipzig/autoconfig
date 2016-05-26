'use strict';

var should = require('should')
	, _ = require('underscore')
	, configtools = require('../lib/vufind2/configtools')
	, program = require('commander')
	, fs = require('fs')
	, path = require('path')
	, rimraf = require('rimraf')
	, mkdirp = require('mkdirp')
	, Q = require('q')
	;


describe('vufind2', function () {

	var site = 'myAwesomeInstance';
	var basedir = path.join(process.cwd(), '.tmp');
	var configDir = path.join(basedir, site, site, 'config', 'vufind');
	var languageDir = path.join(basedir, site, site, 'languages');
	var languageFilesToResolve = [];
	var configFilesToResolve = [];


	before(function (done) {
		fs.stat(basedir, function (err, stats) {
			if (err) {
				mkdirp.sync(configDir);
				mkdirp.sync(languageDir);
			}
			var files = ['de', 'en', 'es'];

			for (var j = 0; files[j]; j++) {
				var file = path.join(languageDir, files[j] + '.ini');
				fs.writeFileSync(file, 'sample text');
				languageFilesToResolve.push(file);
			}

			for (var i = 1; i < 4; i++) {
				var folder = path.join(languageDir, 'subFolder' + i)
				mkdirp.sync(folder);

				for (var j = 0; files[j]; j++) {
					var file = path.join(folder, files[j] + '.ini');
					fs.writeFileSync(file, 'sample text');
					languageFilesToResolve.push(file);
				}
			}

			files = ['a', 'b', 'c'];

			for (var i = 0; files[i]; i++) {
				var file = path.join(configDir, files[i] + '.ini');
				fs.writeFileSync(file, 'sample text');
				configFilesToResolve.push(file);
			}

			program.basedir = basedir;
			done();
		});

	});

	// after(function (done) {
	// 	rimraf(basedir, done);
	// });

	describe('configtools', function () {
		describe('findParentLanguages', function () {
			it('should return 12 ini paths', function (done) {
				configtools.findParentLanguages(site).then(function (data) {
					return Q.all(_.map(data, function (file) {
						var deferred = Q.defer();

						fs.stat(file, function (err, stat) {
							if (err) return deferred.reject(err);
							if (!stat.isFile()) return deferred.reject(new Error('not a file'));

							languageFilesToResolve.should.containEql(file);
							deferred.resolve(file);
						});

						return deferred.promise;
					}));
				}).then(function (resolvedFiles) {
					resolvedFiles.should.have.lengthOf(languageFilesToResolve.length);
					done();
				}).catch(done);
			});
		});

		describe('findParentConfigs', function () {
			it('should return 3 ini paths', function (done) {
				configtools.findParentConfigs(site).then(function (data) {
					return Q.all(_.map(data, function (file) {
						var deferred = Q.defer();

						fs.stat(file, function (err, stat) {
							if (err) return deferred.reject(err);
							if (!stat.isFile()) return deferred.reject(new Error('not a file'));

							configFilesToResolve.should.containEql(file);
							deferred.resolve(file);
						});

						return deferred.promise;
					}));
				}).then(function (resolvedFiles) {
					resolvedFiles.should.have.lengthOf(configFilesToResolve.length);
					done();
				}).catch(done);
			});
		});

		describe('createConfigs', function() {
			program.instance = 'staging';

			it('should create 3 config inis and 12 language inis without defaults', function(done) {
				configtools.createConfigs(site, {}, configFilesToResolve, languageFilesToResolve).then(function(createdFiles) {
					Object.keys(createdFiles).should.have.lengthOf(configFilesToResolve.length);
					done();
				}).catch(done);
			});
		});
	});
});