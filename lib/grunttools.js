'use strict';

var npmtools = require('./npmtools')
    , program = require('commander')
    , exec = require('child_process').exec
    , Q = require('q')
;

exports.foundation = function() {
	var deferred = Q.defer();

	npmtools.install().then(function() {
		exec('grunt', {cwd: program.basedir}, function(err, stdout) {
			if (err) return deferred.reject(err);
			console.log(stdout);
			return deferred.resolve();
		});
	}).catch(deferred.reject);

	return deferred.promise;
};