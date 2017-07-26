'use strict';

var _ = require('underscore');
var pwgen = require('password-generator');
var Q = require('q');

module.exports = function (options, defaults) {
	var deferred = Q.defer();

	if (!defaults.Database || !defaults.Database.database) {
		var database = options.cOptions.dbName;
		var user = options.cOptions.dbName;
		var password = pwgen(16, false);
		var host = options.cOptions.dbServer;

		defaults.Database = {
			database: 'mysql://' + user + ':' + password + '@' + host + '/' + database
		};
	}

	if (!defaults.Index || !defaults.Index.url) {
		defaults = _.extend(defaults, {
			Index: {
				url: options.cOptions.solrUrl
			}
		});
	}

	if (!defaults.Authentication || !defaults.Authentication.ils_encryption_key) {
		defaults = _.extend(defaults, {
			Authentication: {
				ils_encryption_key: pwgen(40, false, /[a-g0-9]/)
			}
		});
	}

	if (!defaults.Site || !defaults.Site.url) {
		defaults = _.extend(defaults, {
			Site: {
				url: options.cOptions.url
			}
		});
	}

	deferred.resolve(defaults);

	return deferred.promise;
};