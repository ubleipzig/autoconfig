/*global describe beforeEach afterEach it*/

'use strict';

var npmtools = require('../lib/npmtools');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var cp = require('cp');

require('should');

describe('npmtools', function () {

	var basedir = path.join(process.cwd(), '.tmp');
	var packageFile = path.join(process.cwd(), 'test', 'data', 'npmtools', 'package.json');

	beforeEach(function (done) {
		mkdirp(basedir, function (err) {
			done(err);
		});
	});

	afterEach(function (done) {
		rimraf(basedir, done);
	});

	describe('install without package.json', function () {
		it('should skip installation', function (done) {
			npmtools.install(basedir).then(function (stdout) {
				done(new Error('no error was thrown: ' + stdout));
			}).catch(function(err) {
				if (err.code === 'ENOENT') return done();
				done(err);
			});
		});
	});

	describe('install with package.json', function () {
		this.timeout(60000);
		beforeEach(function (done) {
			cp(packageFile, path.join(basedir, 'package.json'), done);
		});

		it('should skip installation', function (done) {
			npmtools.install(basedir).then(function () {
				done();
			}).catch(done);
		});
	});
});