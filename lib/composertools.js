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
	path = require('path'),
	Q = require('q'),
	fs = require('fs');

var options;

module.exports = function (overrides) {
	options = overrides;

	return {
		composer: composer
	};
};

var composer = function () {
	var deferred = Q.defer();

	try {
		fs.statSync(path.join(options.basedir, 'node_modules', 'getcomposer', 'composer.phar'));
		exec('php node_modules/getcomposer/composer.phar install --prefer-dist --optimize-autoloader', {
			cwd: options.basedir
		}, function (err, stdout) {
			if (err) {
				console.log(err);
				return deferred.reject(err);
			}
			return deferred.resolve(stdout);
		});
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('Composer is not installed, skipping installation of required composer packages.');
			deferred.resolve(err);
		} else {
			deferred.reject(err);
		}
	}
	return deferred.promise;
};