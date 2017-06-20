/*global describe before after it*/

'use strict';

var _ = require('underscore')
	, configtools = require('../lib/vufind/configtools')
	, program = require('commander')
	, fs = require('fs')
	, path = require('path')
	, mkdirp = require('mkdirp')
	, rimraf = require('rimraf')
	, Q = require('q')
	, readdir = require('recursive-readdir')
	;

require('should');

describe('vufind', function () {

	var site = 'myAwesomeInstance';
	var instance = 'staging';
	var basedir = path.join(process.cwd(), '.tmp');
	var siteDir = path.join(basedir, site);
	var configDir = path.join(siteDir, 'config', 'vufind');
	var languageDir = path.join(siteDir, 'languages');
	var instanceDir = path.join(siteDir, instance);
	var instanceConfigDir = path.join(instanceDir, 'config', 'vufind');
	var instanceLanguageDir = path.join(instanceDir, 'languages');
	var languageFilesToResolve = [];
	var configFilesToResolve = [];


	before(function (done) {
		mkdirp.sync(configDir);
		mkdirp.sync(languageDir);
		var files = ['de', 'en', 'es'];

		for (var j = 0; files[j]; j++) {
			var file = path.join(languageDir, files[j] + '.ini');
			fs.writeFileSync(file, 'sample text');
			languageFilesToResolve.push(file);
		}

		file = null;

		for (var i = 1; i < 4; i++) {
			var folder = path.join(languageDir, 'subFolder' + i);
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

	after(function (done) {
		rimraf(basedir, done);
	});

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
			var createdConfigs,
				createdLanguages;
			before(function(done) {
				program.instance = instance;
				configtools.createConfigs(site, {}, configFilesToResolve, languageFilesToResolve).then(function() {
					Q.spread([
						readInis(instanceLanguageDir),
						readInis(instanceConfigDir)
					], function(lang, conf) {
						createdLanguages = lang;
						createdConfigs = conf;
						done();
					}).catch(done);
				});
			});

			it('should create 3 config inis without defaults', function(done) {
				Object.keys(createdConfigs).should.have.lengthOf(configFilesToResolve.length);
				done();
			});

			it('should create 12 language inis', function(done) {
				Object.keys(createdLanguages).should.have.lengthOf(languageFilesToResolve.length);
				done();
			});


			it('should reference parent language files from instanceLanguageBasePath', function(done) {
				Q.all(createdLanguages.map(function(languageFile) {
					return Q.all(fs.readFileSync(languageFile, {encoding: 'utf-8'}).split('\n').map(function(line) {
						var deferred = Q.defer();
						var match = line.match(/^@parent_ini\s*=\s*"([^"]+)"/, 'm');
						if (match === null) {
							deferred.resolve();
						} else {
							var parentFile = path.resolve(instanceLanguageDir, match[1]);
							fs.stat(parentFile, function (err) {
								if (err) return deferred.reject(err);
								deferred.resolve(parentFile);
							});
						}
						return deferred.promise;
					}));
				})).then(function() {
					done();
				});
			});
		});
	});
});

function readInis(dir) {
	var deferred = Q.defer();
	try {
		readdir(dir, function(err, list) {
			if (err) deferred.reject(err);
			deferred.resolve(list);
		});
	} catch (err) {
		deferred.reject(err);
	}
	return deferred.promise;
}