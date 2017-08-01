/*global describe beforeEach afterEach it*/

'use strict';

var _ = require('underscore'),
	fs = require('fs'),
	path = require('path'),
	mkdirp = require('mkdirp'),
	Q = require('q'),
	readdir = require('recursive-readdir'),
	rimraf = require('rimraf'),
	dir = require('node-dir'),
	cp = require('node-cp'),
	ini = require('ini');

require('should');

describe('vufind', function () {

	var options = {
		basedir: path.join(process.cwd(), '.tmp'),
		instance: 'staging',
		site: 'myAwesomeInstance',
		url: 'http://example.com',
	};

	var defaults = {
		'config.ini': {
			Database: {
				database: 'mysql://testdbuser:testdbpass@testdbserver/testdb'
			}
		}
	};

	var siteDir = path.join(options.basedir, options.site);
	var configFiles = path.join(process.cwd(), 'test', 'data', 'configtools', options.site);
	var stagingFiles = path.join(process.cwd(), 'test', 'data', 'configtools', 'staging');
	var configDir = path.join(siteDir, 'config', 'vufind');
	var languageDir = path.join(siteDir, 'languages');
	var instanceDir = path.join(siteDir, options.instance);
	var instanceConfigDir = path.join(instanceDir, 'config', 'vufind');
	var instanceLanguageDir = path.join(instanceDir, 'languages');
	var languageFilesToResolve = [];
	var configFilesToResolve = [];

	beforeEach(function (done) {
		mkdirp.sync(options.basedir);
		cp(configFiles, path.resolve(options.basedir, options.site), function (err) {
			if (err) return done(err);
			Q.spread([
				Q.nfcall(dir.files, languageDir),
				Q.nfcall(dir.files, configDir)
			], function (lf, cf) {
				languageFilesToResolve = lf;
				configFilesToResolve = cf;
				done();
			}).catch(done);
		});
	});

	afterEach(function (done) {
		rimraf(options.basedir, done);
	});

	describe('configtools', function () {
		var configtools = require('../lib/vufind/configtools')(options);
		describe('findParentLanguages', function () {
			it('should return 12 ini paths', function (done) {
				configtools.findParentLanguages().then(function (data) {
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
				configtools.findParentConfigs().then(function (data) {
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

		describe('createConfigs', function () {

			describe('with empty destination folder', function () {
				var createdConfigs,
					createdLanguages;
				beforeEach(function (done) {
					configtools.createConfigs({}, configFilesToResolve, languageFilesToResolve).then(function () {
						Q.spread([
							readInis(instanceLanguageDir),
							readInis(instanceConfigDir)
						], function (lang, conf) {
							createdLanguages = lang;
							createdConfigs = conf;
							done();
						}).catch(done);
					});
				});

				it('should create 3 config inis without defaults', function (done) {
					Object.keys(createdConfigs).should.have.lengthOf(configFilesToResolve.length);
					createdConfigs.map(function (config) {
						fs.statSync(config).size.should.eql(59);
					});
					done();
				});

				it('should create 12 language inis', function (done) {
					Object.keys(createdLanguages).should.have.lengthOf(languageFilesToResolve.length);
					done();
				});

				it('should reference parent language files from instanceLanguageBasePath', function (done) {
					Q.all(createdLanguages.map(function (languageFile) {
						return Q.all(fs.readFileSync(languageFile, {
							encoding: 'utf-8'
						}).split('\n').map(function (line) {
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
					})).then(function () {
						done();
					});
				});
			});

			describe('with existing configuration files', function () {
				var newDefaults;
				beforeEach(function (done) {
					Q.nfcall(cp, stagingFiles, path.resolve(options.basedir, options.site, 'staging'))
						.then(function () {
							return configtools.createConfigs(defaults, configFilesToResolve, languageFilesToResolve);
						}).then(function (res) {
							newDefaults = res;
							done();
						}).catch(done);
				});
				it('should extend the ini-files', function (done) {
					fs.statSync(path.resolve(instanceConfigDir, 'config.ini')).size.should.eql(197);
					Object.keys(newDefaults['config.ini']).should.containEql('Authentication' , 'Global', 'Site', 'Database');
					newDefaults['config.ini'].Site.url.should.eql('http://example.com');
					done();
				});

				it('should leave all other files', function (done) {
					fs.statSync(path.resolve(instanceConfigDir, 'custom.ini')).size.should.eql(17);
					fs.statSync(path.resolve(instanceConfigDir, 'a.ini')).size.should.eql(17);
					done();
				});
			});
		});

	});
});

function readInis(dir) {
	var deferred = Q.defer();
	try {
		readdir(dir, function (err, list) {
			if (err) deferred.reject(err);
			deferred.resolve(list);
		});
	} catch (err) {
		deferred.reject(err);
	}
	return deferred.promise;
}