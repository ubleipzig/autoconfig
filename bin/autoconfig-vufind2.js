#!/usr/bin/env node
'use strict';

var program = require('commander')
	, Q = require('q')
	, _ = require('underscore')
	, fs = require('fs')
	, path = require('path')
	;

program
	.usage('[options] <site ...>')
	.option('-b, --basedir [value]', 'where the configuration is saved', '/usr/local/vufind2/')
	.option('-i, --instance <value>', 'the instance to set up', /^(alpha|staging|live)$/i)
	.option('-d, --defaults [value]', 'the folder with default overrides. they must follow the naming convention <site>.json', '/etc/autoconfig/')
	.parse(process.argv);

if (!program.instance) {
	console.error('please specify the instance to set up');
	process.exit(1);
}

if (!program.args) {
	console.error('please specify at least one site to set up');
}

program.args.forEach(function(site) {
	Q.all([
		fetchDefaults(site),
		findParentConfigs(site)
	]).then(function(result) {
		return createConfigs(site, result[0], result[1]);
	}, function(err) {
		throw new Error(err);
	}).then(function(result) {
		console.log('happy deployed');
	}, function(err) {
		throw new Error(err);
	});
});

/**
 * fetches defaults
 *
 * @param site name
 */
function fetchDefaults(site) {
	var deferred = Q.defer();
	var defaultsPath = path.join(program.defaults, site + '.json');
	console.log('parsing defaults from %s', defaultsPath);
	fs.readFile(defaultsPath, function(err, data) {
		if (err) deferred.reject(err);
		var defaults = JSON.parse(data);
		deferred.resolve(defaults);
	});
	return deferred.promise;
};

function findParentConfigs(site) {
	var deferred = Q.defer();
	var configPath = path.join(program.basedir, site, site, 'config', 'vufind');
	console.log('reading configs from %s', configPath);
	deferred.resolve();
	return deferred.promise
};

function createConfigs(site, defaults, configs) {
	var instanceConfigPath = path.join(program.basedir, site, site, instance);
	console.log('creating instance config dir %s', instanceConfigPath);
	fs.mkdirSync(instanceConfigPath);
	return Q.all(_.map(configs, function(item) {
		console.log('including %s', item);
		return require('../vufind2/'+ item)(defaults);
	}));
};

