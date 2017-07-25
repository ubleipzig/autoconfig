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