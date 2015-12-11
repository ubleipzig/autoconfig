'use strict';

var exec = require('child_process').exec
    , Q = require('q')
    , program = require('commander')
    , path = require('path')
    , fs = require('fs')
    ;

exports.install = function(site) {
    var deferred = Q.defer()
        , basedir = path.resolve(path.join(program.basedir, site))
        ;

    try {
        fs.statSync(path.join(basedir, 'package.json'));
        exec('npm install', {cwd: basedir}, function (err, stdout) {
            if (err) return deferred.reject(err);
            console.log(stdout);
            return deferred.resolve();
        });
    } catch(err) {
        deferred.resolve(err);
    }
    try {
        basedir = path.resolve(path.join(program.basedir, site));
        fs.statSync(path.join(basedir,
            'node_modules/getcomposer/composer.phar install --prefer-dist --optimize-autoloader'));
        exec('php ', {cwd: basedir}, function (err, stdout) {
            if (err) return deferred.reject(err);
            console.log(stdout);
            return deferred.resolve();
        });
    } catch(err) {
        deferred.resolve(err);
    }
    return deferred.promise;
};
