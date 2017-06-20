'use strict';

var program = require('commander'),
	exec = require('child_process').exec,
	path = require('path'),
	Q = require('q'),
	fs = require('fs');

exports.composer = function (result) {
	var deferred = Q.defer();

	try {
		fs.statSync(path.join(program.basedir, 'node_modules', 'getcomposer', 'composer.phar'));
		exec('php node_modules/getcomposer/composer.phar install --prefer-dist --optimize-autoloader', {
			cwd: program.basedir
		}, function (err, stdout) {
			if (err) {
				console.log(err);
				return deferred.reject(err);
			}
			console.log(stdout);
			return deferred.resolve(result);
		});
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('composer is not installed, skipping installation of required composer packages (use `npm install getcomposer --save` in order to make use of it)');
			deferred.resolve(err);
		} else {
			deferred.reject(err);
		}
	}
	return deferred.promise;
};