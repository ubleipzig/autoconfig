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

var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var cp = require('cp');

require('should');

describe('grunttools', function () {

	var options = {
		basedir: path.join(process.cwd(), '.tmp')
	};

	var npmPackageFile = path.join(process.cwd(), 'test', 'data', 'npmtools', 'package.json');
	var gruntPackageFile = path.join(process.cwd(), 'test', 'data', 'grunttools', 'package.json');
	var gruntFile = path.join(process.cwd(), 'test', 'data', 'grunttools', 'Gruntfile.js');

	process.env.PATH = process.env.PATH + ':' + path.join(options.basedir, 'node_modules', '.bin');

	var grunttools = require('../lib/grunttools')(options);

	beforeEach(function (done) {
		mkdirp(options.basedir, function (err) {
			done(err);
		});
	});

	afterEach(function (done) {
		rimraf(options.basedir, done);
	});

	describe('grunt', function () {

		describe('without grunt installed', function () {
			this.timeout(60000);
			beforeEach(function (done) {
				cp(npmPackageFile, path.join(options.basedir, 'package.json'), done);
			});
			it('should skip installation', function (done) {
				grunttools.grunt().then(function (stdout) {
					done(new Error('no error was thrown: ' + stdout));
				}).catch(function (err) {
					if (err.cmd === 'grunt') return done();
					done(err);
				});
			});
		});

		describe('without existing Gruntfile', function () {
			this.timeout(60000);
			beforeEach(function (done) {
				cp(gruntPackageFile, path.join(options.basedir, 'package.json'), done);
			});
			it('should skip installation', function (done) {
				grunttools.grunt().then(function (stdout) {
					done(new Error('no error was thrown: ' + stdout));
				}).catch(function (err) {
					if (err.cmd === 'grunt') return done();
					done(err);
				});
			});
		});

		describe('with all set up', function () {
			this.timeout(60000);
			beforeEach(function (done) {
				try {
					cp.sync(gruntPackageFile, path.join(options.basedir, 'package.json'));
					cp.sync(gruntFile, path.join(options.basedir, 'Gruntfile.js'));
					done();
				} catch (err) {
					done(err);
				}
			});

			it('should run the default task', function (done) {
				grunttools.grunt().then(function () {
					done();
				}).catch(done);
			});
		});
	});
});