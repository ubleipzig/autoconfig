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

var npmtools = require('./npmtools'),
	path = require('path'),
	exec = require('child_process').exec,
	Q = require('q');

var options;

module.exports = function (overrides) {
	options = overrides;

	return {
		grunt: grunt
	};
};

var grunt = function () {
	var deferred = Q.defer();

	npmtools.install(options.basedir).then(function () {

		exec('grunt', {
			cwd: options.basedir,
			env: {
				'PATH': path.resolve(options.basedir, 'node_modules', '.bin') + ':' + process.env.PATH
			}
		}, function (err, stdout, stderr) {
			console.log(stdout);
			console.error(stderr);
			if (err) return deferred.reject(err);
			return deferred.resolve();
		});
	}).catch(deferred.reject);

	return deferred.promise;
};