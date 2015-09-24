'use strict';

var npmtools = require('../npmtools')
    , program = require('commander')
    , exec = require('child_process').exec
    , path = require('path')
    , Q = require('q')
    ;

exports.foundation = function(site) {
    var deferred = Q.defer()
        , basedir = path.resolve(path.join(program.basedir, site))
        ;

    npmtools.install(site).then(function() {
        exec('grunt', {cwd: basedir}, function(err, stdout) {
            if (err) return deferred.reject(err);
            console.log(stdout);
            return deferred.resolve();
        });
    }).catch(deferred.reject);

    return deferred.promise;
};