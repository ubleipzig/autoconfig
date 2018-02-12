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
			}).catch(function (err) {
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