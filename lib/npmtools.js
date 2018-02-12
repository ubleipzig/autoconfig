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

var exec = require('child_process').exec,
	Q = require('q'),
	path = require('path'),
	fs = require('fs');

exports.install = function (basedir) {
	var deferred = Q.defer();

	try {
		fs.statSync(path.join(basedir, 'package.json'));
		exec('npm install', {
			cwd: basedir,
			maxBuffer: 512 * 1024
		}, function (err, stdout) {
			if (err) return deferred.reject(err);
			console.log(stdout);
			return deferred.resolve();
		});
	} catch (err) {
		console.log('npm is not installed, skipping installation of required npm packages');
		deferred.reject(err);
	}
	return deferred.promise;
};