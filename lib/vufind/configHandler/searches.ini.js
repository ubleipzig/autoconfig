'use strict';

var _ = require('underscore');
var Q = require('q');

module.exports = function (config) {
	var deferred = Q.defer();
	try {
		if (!config.ShardPreferences || config.ShardPreferences.showCheckboxes === undefined) {
			config = _.extend(config, {
				ShardPreferences: {
					showCheckboxes: false
				}
			});
		}

		deferred.resolve(config);
	} catch (err) {
		deferred.reject(err);
	}

	return deferred.promise;
};