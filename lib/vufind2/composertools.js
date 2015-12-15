'use strict';

var npmtools = require('../npmtools')
    , program = require('commander')
    , exec = require('child_process').exec
    , path = require('path')
    , Q = require('q')
    , fs = require('fs')
    ;

exports.composer = function(site, result) {
    var deferred = Q.defer()
        , basedir = path.resolve(path.join(program.basedir, site))
    ;
    try {
        fs.statSync(path.join(basedir,
            'node_modules/getcomposer/composer.phar install --prefer-dist --optimize-autoloader'));
        exec('php ', {cwd: basedir}, function (err, stdout) {
            if (err) {
                console.log(err);
                return deferred.reject(err); }
            console.log(stdout);
            return deferred.resolve(result);
        });
    } catch(err) {
        console.log(err);
        deferred.resolve(err);
    }
    return deferred.promise;
};


