'use strict';

var npmtools = require('./npmtools'),
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
			cwd: options.basedir
		}, function (err, stdout) {
			if (err) return deferred.reject(err);
			console.log(stdout);
			return deferred.resolve(stdout);
		});
	}).catch(deferred.reject);

	return deferred.promise;
};