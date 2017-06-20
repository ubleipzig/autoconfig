'use strict';

var exec = require('child_process').exec,
	Q = require('q'),
	program = require('commander'),
	path = require('path'),
	fs = require('fs');

exports.install = function () {
	var deferred = Q.defer();

	try {
		fs.statSync(path.join(program.basedir, 'package.json'));
		exec('npm install', {
			cwd: program.basedir
		}, function (err, stdout) {
			if (err) return deferred.reject(err);
			console.log(stdout);
			return deferred.resolve();
		});
	} catch (err) {
		deferred.resolve(err);
	}
	return deferred.promise;
};