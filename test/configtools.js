/*global describe beforeEach afterEach it*/

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

var _ = require('underscore'),
	fs = require('fs'),
	path = require('path'),
	mkdirp = require('mkdirp'),
	Q = require('q'),
	readdir = require('recursive-readdir'),
	rimraf = require('rimraf'),
	dir = require('node-dir'),
	cp = require('node-cp'),
	ini = require('multi-ini'),
	configtools = require('../lib/vufind/configtools'),
	should = require('should'),
	yaml = require('js-yaml');

describe('vufind', function () {

	var options = {
		basedir: path.join(process.cwd(), '.tmp'),
		instance: 'staging',
		site: 'myAwesomeInstance',
		dbName: 'my_awesome_instance',
		dbServer: 'localhost',
		settingsFile: path.join(process.cwd(), 'test', 'data', 'configtools', 'settings.json'),
		args: {
			'args.ini': {
				'My_SpecialSection': {
					'special_key': 'generic string'
				}
			},
			'config.ini': {
				'Site': {
					'url': 'http://example.com'
				},
				'Database': {
					'database': 'mysql://testdbuser:testdbpass@testdbserver/testdb'
				}
			},
			'foreignCopyChild.yml': {
				'@parent_yaml': 'foreignCopy.yml',
				'DeweyBrowse': {
					'QueryFields': {
						'dewey-raw': [
							null, 'onephrase'
						]
					}
				}
			},
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
			}).catch(() => {
				done();
			});
		});
	});

	afterEach(function (done) {
		rimraf(options.basedir, done);
	});

	describe('configtools', function () {
		var ct;
		beforeEach(done => {
			ct = configtools(options);
			done();
		});
		describe('findParentConfigs with non-existing config folder', function () {
			beforeEach(done => {
				ct = configtools(_.extend({}, options, {
					site: 'unknownSite'
				}));
				done();
			});
			it('should return an empty array', function (done) {
				ct.findParentConfigs().then(function (data) {
					should(data).eql([]);
					done();
				}).catch(() => {
					done();
				});
			});
		});

		describe('findParentConfigs with existing config folder', function () {
			it('should return 3 ini paths', function (done) {
				ct.findParentConfigs().then(function (data) {
					return Q.all(data.map(function (file) {
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

		describe('findParentLanguages', function () {
			it('should return 12 ini paths', function (done) {
				ct.findParentLanguages().then(function (data) {
					return Q.all(data.map(function (file) {
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

		describe('createMissingConfigs', function () {

			describe('with empty destination folder', function () {
				var createdConfigs;
				beforeEach(function (done) {
					ct.findParentConfigs().then(ct.createMissingConfigs).then(function () {
						return readInis(instanceConfigDir);
					}).then(configs => {
						createdConfigs = configs;
						done();
					}).catch(done);
				});

				it('should create 3 config inis without defaults', function (done) {
					Object.keys(createdConfigs).should.have.lengthOf(configFilesToResolve.length);
					createdConfigs.map(function (config) {
						if (config.substr(-3) === 'ini') fs.statSync(config).size.should.eql(1012);
					});
					done();
				});
			});

			describe('with existing configuration files', function () {
				beforeEach(function (done) {
					Q.nfcall(cp, stagingFiles, path.resolve(options.basedir, options.site, 'staging'))
						.then(function () {
							return ct.findParentConfigs().then(ct.createMissingConfigs);
						}).then(function () {
							done();
						}).catch(done);
				});

				it('should leave all existing files', function (done) {
					fs.statSync(path.resolve(instanceConfigDir, 'config.ini')).size.should.eql(79);
					fs.statSync(path.resolve(instanceConfigDir, 'custom.ini')).size.should.eql(26);
					fs.statSync(path.resolve(instanceConfigDir, 'a.ini')).size.should.eql(29);
					fs.statSync(path.resolve(instanceConfigDir, 'foreignLeave.yml')).size.should.eql(25);
					fs.statSync(path.resolve(instanceConfigDir, 'foreignCopy.yml')).size.should.eql(24);
					done();
				});
			});
		});

		describe('createMissingLanguages', function () {

			describe('with empty destination folder', function () {
				var createdLanguages;
				beforeEach(function (done) {
					ct.findParentLanguages().then(ct.createMissingLanguages).then(function () {
						return readInis(instanceLanguageDir);
					}).then(languages => {
						createdLanguages = languages;
						done();
					}).catch(done);
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
		});

		describe('updateRuntimeConfigs', function () {

			describe('with empty destination folder', function () {
				beforeEach(function (done) {
					ct.findParentConfigs().then(ct.createMissingConfigs).then(() => {
						return ct.findTargetConfigs().then(ct.mergeRuntimeConfigs).then(ct.updateRuntimeConfigs);
					}).then(() => {
						done();
					}).catch(done);
				});

				it('should create  the config.ini with defaults', function (done) {
					let configIni = ini.read(path.resolve(instanceConfigDir, 'config.ini'), {
						encoding: 'utf8',
						keep_quotes: true
					});
					configIni.should.have.properties('Database', 'Authentication');
					configIni.Database.should.have.properties('database');
					configIni.Authentication.should.have.properties('ils_encryption_key');
					done();
				});

				it('should create the searches.ini with defaults', function (done) {
					let searchesIni = ini.read(path.resolve(instanceConfigDir, 'searches.ini'), {
						encoding: 'utf8',
						keep_quotes: true
					});
					searchesIni.should.have.properties('ShardPreferences');
					searchesIni.ShardPreferences.should.have.properties('showCheckboxes');
					searchesIni.ShardPreferences.showCheckboxes.should.eql('false');
					done();
				});
				it('should create the env.ini with environment variables', function (done) {
					let envIni = ini.read(path.resolve(instanceConfigDir, 'env.ini'), {
						encoding: 'utf8',
						keep_quotes: true
					});
					envIni.should.have.properties('My_SpecialSection');
					envIni.My_SpecialSection.should.have.properties('special_key');
					envIni.My_SpecialSection.special_key.should.eql('generic string');
					done();
				});
				it('should create the args.ini with commandline arguments', function (done) {
					let argsIni = ini.read(path.resolve(instanceConfigDir, 'args.ini'), {
						encoding: 'utf8',
						keep_quotes: true
					});
					argsIni.should.have.properties('My_SpecialSection');
					argsIni.My_SpecialSection.should.have.properties('special_key');
					argsIni.My_SpecialSection.special_key.should.eql('generic string');
					done();
				});
			});

			describe('with existing configuration files', function () {
				beforeEach(function (done) {
					Q.nfcall(cp, stagingFiles, path.resolve(options.basedir, options.site, 'staging')).then(() => {
						return ct.findParentConfigs().then(ct.createMissingConfigs);
					}).then(() => {
						return ct.findTargetConfigs().then(ct.mergeRuntimeConfigs).then(ct.updateRuntimeConfigs);
					}).then(() => {
						done();
					}).catch(done);
				});

				it('should extend the ini-files', function (done) {
					let configIni = ini.read(path.resolve(instanceConfigDir, 'config.ini'), {
						encoding: 'utf8',
						keep_quotes: true
					});
					configIni.should.have.properties('Global', 'Site', 'Database', 'Authentication');
					configIni.Site.should.have.properties('url', 'customVar');
					configIni.Site.url.should.eql('http://example.com');
					configIni.Site.customVar.should.eql('"customValue"');
					done();
				});

				it('should override the yml-files', function (done) {
					let childYmlString = fs.readFileSync(`${instanceConfigDir}/foreignCopyChild.yml`, 'utf8');
					let childYmlObject = yaml.safeLoad(childYmlString);
					childYmlObject.should.have.properties('@parent_yaml', 'DeweyBrowse');
					childYmlObject['@parent_yaml'].should.eql('foreignCopy.yml');
					childYmlObject.DeweyBrowse.QueryFields.should.eql({'dewey-raw': [null, 'onephrase']});
					done();
				});

				it('should leave all other files', function (done) {
					fs.statSync(path.resolve(instanceConfigDir, 'custom.ini')).size.should.eql(25);
					fs.statSync(path.resolve(instanceConfigDir, 'a.ini')).size.should.eql(28);
					fs.statSync(path.resolve(instanceConfigDir, 'foreignLeave.yml')).size.should.eql(25);
					fs.statSync(path.resolve(instanceConfigDir, 'foreignCopy.yml')).size.should.eql(24);
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