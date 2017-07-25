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
			maxBuffer: 512*1024
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