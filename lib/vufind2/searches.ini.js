'use strict';

var _ = require('underscore');
var Q = require('q');
var program = require('commander');

module.exports = function (options, defaults) {
	var deferred = Q.defer();
	try {
		if (!defaults.IndexShards || !defaults.IndexShards.ai) {
			defaults = _.extend(defaults, {IndexShards: {ai: program.aiUrl}});
		}

		if (!defaults.ShardPreferences || defaults.ShardPreferences.showCheckboxes === undefined) {
			defaults = _.extend(defaults, {ShardPreferences: {showCheckboxes: false}});
		}

		deferred.resolve(defaults);
	} catch (err) {
		deferred.reject(err);
	}

	return deferred.promise;
};